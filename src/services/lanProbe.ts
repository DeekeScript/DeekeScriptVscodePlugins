import * as net from 'net';
import * as os from 'os';

const PROBE_TIMEOUT_MS = 400;
const SCAN_BATCH_SIZE = 48;
/** 单网段最多扫描主机数，避免 /16 等大网段扫爆 */
const MAX_HOSTS_PER_SUBNET = 254;

export interface LocalLanNetwork {
	/** 本机在该网段上的 IPv4 地址 */
	localAddress: string;
	/** 根据本机 IP + 掩码推导的扫描范围（含首尾） */
	scanStart: number;
	scanEnd: number;
}

function isIPv4(family: string | number): boolean {
	return family === 'IPv4' || family === 4;
}

function ipToInt(ip: string): number {
	const parts = ip.split('.').map((part) => Number(part));
	if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
		return 0;
	}
	return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIp(value: number): string {
	return [
		(value >>> 24) & 255,
		(value >>> 16) & 255,
		(value >>> 8) & 255,
		value & 255,
	].join('.');
}

function is192168Address(ip: string): boolean {
	return ip.startsWith('192.168.');
}

function shouldSkipAddress(ip: string): boolean {
	if (ip.startsWith('127.')) {
		return true;
	}
	if (ip.startsWith('169.254.')) {
		return true;
	}
	return !is192168Address(ip);
}

function prefixLengthFromNetmask(netmask: string): number | null {
	const mask = ipToInt(netmask);
	if (mask === 0) {
		return null;
	}

	let bits = 0;
	for (let shift = 31; shift >= 0; shift--) {
		if ((mask >>> shift) & 1) {
			bits++;
		} else {
			break;
		}
	}

	const expected = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
	if (mask !== expected) {
		return null;
	}
	return bits;
}

function prefixLengthFromCidr(cidr: string): number | null {
	const slash = cidr.indexOf('/');
	if (slash < 0) {
		return null;
	}
	const prefix = Number(cidr.slice(slash + 1));
	if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
		return null;
	}
	return prefix;
}

function hostRangeFromPrefix(localAddress: string, prefixLength: number): { scanStart: number; scanEnd: number } {
	const ipInt = ipToInt(localAddress);
	const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
	const network = ipInt & mask;
	const broadcast = network | (~mask >>> 0);
	let scanStart = network + 1;
	let scanEnd = broadcast - 1;

	const hostCount = scanEnd - scanStart + 1;
	if (hostCount > MAX_HOSTS_PER_SUBNET) {
		const classCBase = ipInt & 0xffffff00;
		scanStart = classCBase + 1;
		scanEnd = classCBase + 254;
	}

	return { scanStart, scanEnd };
}

/** 读取本机 192.168.x.x 网卡及对应扫描范围 */
export function getLocalLanNetworks(): LocalLanNetwork[] {
	const networks: LocalLanNetwork[] = [];
	const seen = new Set<string>();

	for (const ifaces of Object.values(os.networkInterfaces())) {
		if (!ifaces) {
			continue;
		}
		for (const iface of ifaces) {
			if (!isIPv4(iface.family) || iface.internal) {
				continue;
			}

			const localAddress = iface.address;
			if (shouldSkipAddress(localAddress)) {
				continue;
			}

			let prefixLength: number | null = null;
			if (typeof iface.cidr === 'string') {
				prefixLength = prefixLengthFromCidr(iface.cidr);
			}
			if (prefixLength === null && typeof iface.netmask === 'string') {
				prefixLength = prefixLengthFromNetmask(iface.netmask);
			}
			if (prefixLength === null) {
				prefixLength = 24;
			}

			const { scanStart, scanEnd } = hostRangeFromPrefix(localAddress, prefixLength);
			const key = `${localAddress}|${scanStart}|${scanEnd}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);

			networks.push({ localAddress, scanStart, scanEnd });
		}
	}

	return networks;
}

/** 本机局域网 IPv4 列表（仅地址，便于日志展示） */
export function getLocalLanAddresses(): string[] {
	return getLocalLanNetworks().map((item) => item.localAddress);
}

/** TCP 探测指定 IP 端口是否可达（WebSocket 服务端口） */
export function probeHost(ip: string, port: number, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new net.Socket();
		let settled = false;

		const finish = (ok: boolean) => {
			if (settled) {
				return;
			}
			settled = true;
			socket.destroy();
			resolve(ok);
		};

		socket.setTimeout(timeoutMs);
		socket.once('connect', () => finish(true));
		socket.once('timeout', () => finish(false));
		socket.once('error', () => finish(false));
		socket.connect(port, ip);
	});
}

async function scanRange(scanStart: number, scanEnd: number, port: number, skipIp?: string): Promise<string[]> {
	const found: string[] = [];
	const skipInt = skipIp ? ipToInt(skipIp) : 0;

	for (let start = scanStart; start <= scanEnd; start += SCAN_BATCH_SIZE) {
		const end = Math.min(start + SCAN_BATCH_SIZE - 1, scanEnd);
		const tasks: Promise<string | null>[] = [];

		for (let host = start; host <= end; host++) {
			if (host === skipInt) {
				continue;
			}
			const ip = intToIp(host);
			if (!is192168Address(ip)) {
				continue;
			}
			tasks.push(probeHost(ip, port).then((ok) => (ok ? ip : null)));
		}

		const batch = await Promise.all(tasks);
		for (const ip of batch) {
			if (ip) {
				found.push(ip);
			}
		}
	}

	return found;
}

/** 扫描局域网内开放了指定端口的设备 */
export async function discoverDevices(port: number, lastKnownIp?: string): Promise<string[]> {
	if (lastKnownIp && !shouldSkipAddress(lastKnownIp) && (await probeHost(lastKnownIp, port))) {
		return [lastKnownIp];
	}

	const networks = getLocalLanNetworks();
	if (networks.length === 0) {
		return [];
	}

	const found = new Set<string>();
	for (const network of networks) {
		const ips = await scanRange(network.scanStart, network.scanEnd, port, network.localAddress);
		for (const ip of ips) {
			found.add(ip);
		}
	}

	return [...found].filter(is192168Address);
}

/** 扫描范围描述，用于日志 */
export function describeScanTargets(): string {
	const networks = getLocalLanNetworks();
	if (networks.length === 0) {
		return '未检测到 192.168.x.x 网卡';
	}
	return networks
		.map((network) => {
			const from = intToIp(network.scanStart);
			const to = intToIp(network.scanEnd);
			return `${network.localAddress} → ${from} ~ ${to}`;
		})
		.join('；');
}

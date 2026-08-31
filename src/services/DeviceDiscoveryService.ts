import { describeScanTargets, discoverDevices } from './lanProbe';
import log from '../unit/log';

export interface DeviceDiscoveryOptions {
	port: number;
	intervalMs: number;
	shouldScan: () => boolean;
	getLastKnownIp: () => string | undefined;
	onDevicesFound: (ips: string[]) => void | Promise<void>;
}

export class DeviceDiscoveryService {
	private timer: ReturnType<typeof setInterval> | null = null;
	private scanning = false;
	private paused = false;
	private loggedTargets = false;
	private readonly options: DeviceDiscoveryOptions;

	constructor(options: DeviceDiscoveryOptions) {
		this.options = options;
	}

	start(): void {
		if (this.timer) {
			return;
		}
		this.timer = setInterval(() => {
			void this.tick();
		}, this.options.intervalMs);
		// 启动后立即扫一次
		void this.tick();
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.scanning = false;
		this.loggedTargets = false;
	}

	pause(): void {
		this.paused = true;
	}

	resume(): void {
		this.paused = false;
	}

	updatePort(port: number): void {
		this.options.port = port;
	}

	private async tick(): Promise<void> {
		if (this.paused || this.scanning || !this.options.shouldScan()) {
			return;
		}

		this.scanning = true;
		try {
			if (!this.loggedTargets) {
				log.info(`192.168 网段扫描：${describeScanTargets()}（端口 ${this.options.port}）`);
				this.loggedTargets = true;
			}
			const ips = await discoverDevices(this.options.port, this.options.getLastKnownIp());
			if (ips.length === 0 || !this.options.shouldScan()) {
				return;
			}
			if (ips.length === 1) {
				log.showInfo(`局域网扫描发现手机 ${ips[0]}，正在连接...`);
			} else {
				log.showInfo(`局域网扫描发现 ${ips.length} 台手机：${ips.join(', ')}`);
			}
			await this.options.onDevicesFound(ips);
		} catch (error) {
			log.error(`局域网扫描失败：${error instanceof Error ? error.message : '未知错误'}`);
		} finally {
			this.scanning = false;
		}
	}
}

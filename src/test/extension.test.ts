// import * as assert from 'assert';

// // You can import and use all API from the 'vscode' module
// // as well as import your extension to test it
// import * as vscode from 'vscode';
// // import * as myExtension from '../../extension';

// // suite('Extension Test Suite', () => {
// // 	vscode.window.showInformationMessage('Start all tests.');

// // 	test('Sample test', () => {
// // 		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
// // 		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
// // 	});
// // });

import { MessageEvent, WebSocket } from 'ws';

try {
    console.log('start');
    //                          ws://192.168.1.155:8088
    let socket = new WebSocket('ws://192.168.1.175:8088');
    socket.on('open', () => {
        console.log('open');
        socket.send('{"type":"init"}');
    });
    socket.on('message', (event: MessageEvent) => {
        console.log('message', event.data);
    });
    socket.on('error', (event: any) => {
        console.log('error', event);
    });
    socket.on('close', (event: any) => {
        console.log('close', event);
    });
} catch (e: any) {
    console.log(e);
}

/**
 * Copyright (c) 2015, 2016, Oracle and/or its affiliates. All rights reserved.
 *
 * This software is dual-licensed to you under the MIT License (MIT) and
 * the Universal Permissive License (UPL). See the LICENSE file in the root
 * directory for license terms. You may choose either license, or both.
 *
 */

/*
 * This sample presents a simple humidity sensor to the IoT server.
 *
 * It uses the MessageDispatcher utility to send messages and to handle
 * resource requests from the server.
 *
 * The simple sensor is polled every 3 seconds and a data message is
 * sent to the server and an alert message if the when alert condition is met.
 *
 * The client is a directly connected device using the advanced API.
 */

dcl = require("device-library.node");
dcl = dcl({debug: true});

var storeFile = (process.argv[2]);
var storePassword = (process.argv[3]);

function _getMethodForRequestMessage(requestMessage){
    var method = null;
    if (requestMessage.payload && requestMessage.payload.method) {
        method = requestMessage.payload.method.toUpperCase();
    }
    if (requestMessage.payload.headers && Array.isArray(requestMessage.payload.headers['x-http-method-override']) && (requestMessage.payload.headers['x-http-method-override'].length > 0)) {
        method = requestMessage.payload.headers['x-http-method-override'][0].toUpperCase();
    }
    return method;
}

function startHumidity(device) {

    var sensor = {
        humidity: 0,
        maxThreshold: 100
    };

    var handleSend = function (messages, error) {
        if (error) {
            console.log('-----------------ERROR ON SENDING MESSAGES------------------');
            console.log(error.message);
            console.log('------------------------------------------------------------');
        }
    };

    var send = function () {
        sensor.humidity = Math.floor(Math.random() * 100);
        if (sensor.humidity > sensor.maxThreshold) {
            var message = dcl.message.Message.AlertMessage.buildAlertMessage('urn:com:oracle:iot:device:humidity_sensor:too_humid',
                'Sample alert when humidity reaches the maximum humidity threshold',
                dcl.message.Message.AlertMessage.Severity.SIGNIFICANT);
            message.source(device.getEndpointId());
            message.dataItem('humidity', sensor.humidity);
            device.send([message], handleSend);
            console.log('sent humidity ALERT: '+sensor.humidity);
        }
        var message = new dcl.message.Message();
        message
            .type(dcl.message.Message.Type.DATA)
            .source(device.getEndpointId())
            .format('urn:com:oracle:iot:device:humidity_sensor' + ":attributes");
        message.dataItem('humidity', sensor.humidity);
        message.dataItem('maxThreshold', sensor.maxThreshold);
        device.send([message], handleSend);
        console.log('sent humidity DATA: '+sensor.humidity);
    };

    setInterval(send, 3000);

    var requestHandler = function (requestMessage) {
        var method = _getMethodForRequestMessage(requestMessage);
        if (!method || (method !== 'PUT')) {
            return dcl.message.Message.buildResponseMessage(requestMessage, 405, {}, 'Method Not Allowed', '');
        }
        var data = null;
        try {
            data = JSON.parse(dcl.$port.util.atob(requestMessage.payload.body));
        } catch (e) {
            return dcl.message.Message.buildResponseMessage(requestMessage, 400, {}, 'Bad Request', '');
        }
        if (!data || (typeof data.value !== 'number') || (data.value % 1 !== 0) || (data.value < 60) || (data.value > 100) ) {
            return dcl.message.Message.buildResponseMessage(requestMessage, 400, {}, 'Bad Request', '');
        }
        console.log('received UPDATE REQUEST maxThreshold:' + data.value);
        sensor.maxThreshold = data.value;
        return dcl.message.Message.buildResponseMessage(requestMessage, 200, {}, 'OK', '');
    };

    var receiveMessage = null;
    receiveMessage = function (message) {
        if (message) {
            console.log('-------------------RECEIVED MESSAGE-------------------------');
            console.log(JSON.stringify(message, null, 4));
            console.log('------------------------------------------------------------');
            device.send([requestHandler(message)], handleSend);
        }
        device.receive(receiveMessage);
    };

    device.receive(receiveMessage);
}

var dcd = new dcl.device.util.DirectlyConnectedDevice(storeFile, storePassword);
if (dcd.isActivated()) {
    startHumidity(dcd);
} else {
    dcd.activate(['urn:com:oracle:iot:device:humidity_sensor'], function (device, error) {
        if (error) {
            console.log('-----------------ERROR ON ACTIVATION------------------------');
            console.log(error.message);
            console.log('------------------------------------------------------------');
            return;
        }
        dcd = device;
        console.log(dcd.isActivated());
        if (dcd.isActivated()) {
            startHumidity(dcd);
        }
    });
}

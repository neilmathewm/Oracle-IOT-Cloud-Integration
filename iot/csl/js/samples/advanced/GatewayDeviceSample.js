/**
 * Copyright (c) 2015, 2016, Oracle and/or its affiliates. All rights reserved.
 *
 * This software is dual-licensed to you under the MIT License (MIT) and
 * the Universal Permissive License (UPL). See the LICENSE file in the root
 * directory for license terms. You may choose either license, or both.
 *
 */

/*
 * This sample presents two sensors (humidity sensor and temperature sensor) to the IoT server.
 *
 * It uses the MessageDispatcher utility to send messages and to handle
 * resource requests from the server. Each sensor is an indirectly connected
 * device registered by the same client (a gateway).
 *
 * The sensors are polled every 3 seconds and the humidity and temperature are sent
 * as DATA messages to the server and ALERT messages are sent if if the alert condition is met.
 *
 * Also the temperature sensor can be powered on or off and the min and max temperature
 * can handle a reset using action handlers registered in the RequestDispatcher.
 *
 * The client is a gateway device using the advanced API.
 */

dcl = require("device-library.node");
dcl = dcl({debug: true});

var temperatureIcdId = '_Sample_TS';
var humidityIcdId = '_Sample_HS';

function genICDDetails(hardwareId){
    return {
        manufacturer: 'Sample',
        modelNumber: 'MN-'+hardwareId,
        serialNumber: 'SN-'+hardwareId
    };
}

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

function startHumidity(device, id) {

    var messageDispatcher = new dcl.device.util.MessageDispatcher(device);

    var sensor = {
        humidity: 0,
        maxThreshold: 100
    };

    var send = function () {
        sensor.humidity = Math.floor(Math.random() * 100);
        if (sensor.humidity > sensor.maxThreshold) {
            var message = dcl.message.Message.AlertMessage.buildAlertMessage('urn:com:oracle:iot:device:humidity_sensor:too_humid',
                'Sample alert when humidity reaches the maximum humidity threshold',
                dcl.message.Message.AlertMessage.Severity.SIGNIFICANT);
            message.source(id);
            message.dataItem('humidity', sensor.humidity);
            messageDispatcher.queue(message);
            console.log('sent HUMIDITY ALERT: '+sensor.humidity);
        }
        var message = new dcl.message.Message();
        message
            .type(dcl.message.Message.Type.DATA)
            .source(id)
            .format('urn:com:oracle:iot:device:humidity_sensor' + ":attributes");
        message.dataItem('humidity', sensor.humidity);
        message.dataItem('maxThreshold', sensor.maxThreshold);
        messageDispatcher.queue(message);
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
        console.log('received UPDATE REQUEST for humidity maxThreshold:' + data.value);
        sensor.maxThreshold = data.value;
        return dcl.message.Message.buildResponseMessage(requestMessage, 200, {}, 'OK', '');
    };

    messageDispatcher.getRequestDispatcher().registerRequestHandler(id,
        'deviceModels/urn:com:oracle:iot:device:humidity_sensor/attributes/maxThreshold',
        requestHandler);

}

function startTemperature(device, id) {

    var messageDispatcher = new dcl.device.util.MessageDispatcher(device);

    var sensor = {
        temp: 0,
        minTemp: 0,
        maxTemp: 0,
        unit: 'Cel',
        minThreshold: -20,
        maxThreshold: 80,
        startTime: 0
    };

    var send = function () {
        sensor.temp = Math.floor(Math.random() * 100 - 20);
        if (sensor.temp < sensor.minTemp) {
            sensor.minTemp = sensor.temp;
        }
        if (sensor.temp > sensor.maxTemp) {
            sensor.maxTemp = sensor.temp;
        }
        if (sensor.temp > sensor.maxThreshold) {
            var message = dcl.message.Message.AlertMessage.buildAlertMessage('urn:com:oracle:iot:device:temperature_sensor:too_hot',
                'Temperature has reached the maximum temperature threshold',
                dcl.message.Message.AlertMessage.Severity.SIGNIFICANT);
            message.source(id);
            message.dataItem('temp', sensor.temp);
            message.dataItem('maxThreshold', sensor.maxThreshold);
            message.dataItem('unit', sensor.unit);
            messageDispatcher.queue(message);
            console.log('sent TOO HOT ALERT: '+JSON.stringify(sensor));
        }
        if (sensor.temp < sensor.minThreshold) {
            var message = dcl.message.Message.AlertMessage.buildAlertMessage('urn:com:oracle:iot:device:temperature_sensor:too_cold',
                'Temperature has reached the minimum temperature threshold',
                dcl.message.Message.AlertMessage.Severity.SIGNIFICANT);
            message.source(id);
            message.dataItem('temp', sensor.temp);
            message.dataItem('minThreshold', sensor.minThreshold);
            message.dataItem('unit', sensor.unit);
            messageDispatcher.queue(message);
            console.log('sent TOO COLD ALERT: '+JSON.stringify(sensor));
        }
        var message = new dcl.message.Message();
        message
            .type(dcl.message.Message.Type.DATA)
            .source(id)
            .format('urn:com:oracle:iot:device:temperature_sensor' + ":attributes");
        message.dataItem('temp', sensor.temp);
        message.dataItem('minThreshold', sensor.minThreshold);
        message.dataItem('unit', sensor.unit);
        message.dataItem('minTemp', sensor.minTemp);
        message.dataItem('maxTemp', sensor.maxTemp);
        message.dataItem('maxThreshold', sensor.maxThreshold);
        message.dataItem('startTime', sensor.startTime);
        messageDispatcher.queue(message);
        console.log('sent temperature DATA: '+JSON.stringify(sensor));
    };

    sensor.startTime = Date.now();
    var timer = setInterval(send, 3000);

    var attributesHandler = function (requestMessage) {
        var method = _getMethodForRequestMessage(requestMessage);
        if (!method || (method !== 'PUT')) {
            return dcl.message.Message.buildResponseMessage(requestMessage, 405, {}, 'Method Not Allowed', '');
        }
        var urlAttribute = requestMessage.payload.url.substring(requestMessage.payload.url.lastIndexOf('/') + 1);
        var data = null;
        try {
            data = JSON.parse(dcl.$port.util.atob(requestMessage.payload.body));
        } catch (e) {
            return dcl.message.Message.buildResponseMessage(requestMessage, 400, {}, 'Bad Request', '');
        }
        if (!data || (typeof data.value !== 'number')) {
            return dcl.message.Message.buildResponseMessage(requestMessage, 400, {}, 'Bad Request', '');
        }
        if ((urlAttribute === 'minThreshold') && ((data.value < -20) || (data.value > 0))) {
            return dcl.message.Message.buildResponseMessage(requestMessage, 400, {}, 'Bad Request', '');
        }
        if ((urlAttribute === 'maxThreshold') && ((data.value < 65) || (data.value > 80))) {
            return dcl.message.Message.buildResponseMessage(requestMessage, 400, {}, 'Bad Request', '');
        }
        console.log('received UPDATE REQUEST for temperature '+ urlAttribute + ': ' + data.value);
        sensor[urlAttribute] = data.value;
        return dcl.message.Message.buildResponseMessage(requestMessage, 200, {}, 'OK', '');
    };

    messageDispatcher.getRequestDispatcher().registerRequestHandler(id,
        'deviceModels/urn:com:oracle:iot:device:temperature_sensor/attributes/maxThreshold',
        attributesHandler);

    messageDispatcher.getRequestDispatcher().registerRequestHandler(id,
        'deviceModels/urn:com:oracle:iot:device:temperature_sensor/attributes/minThreshold',
        attributesHandler);

    var actionsHandler = function (requestMessage) {
        var method = _getMethodForRequestMessage(requestMessage);
        if (!method || (method !== 'POST')) {
            return dcl.message.Message.buildResponseMessage(requestMessage, 405, {}, 'Method Not Allowed', '');
        }
        var urlAction = requestMessage.payload.url.substring(requestMessage.payload.url.lastIndexOf('/') + 1);
        if (urlAction === 'power') {
            var data = null;
            try {
                data = JSON.parse(dcl.$port.util.atob(requestMessage.payload.body));
            } catch (e) {
                return dcl.message.Message.buildResponseMessage(requestMessage, 400, {}, 'Bad Request', '');
            }
            if (!data || (typeof data.value !== 'boolean')) {
                return dcl.message.Message.buildResponseMessage(requestMessage, 400, {}, 'Bad Request', '');
            }
            console.log('received POWER ACTION with: ' + data.value);
            if (data.value) {
                sensor.startTime = Date.now();
                timer = setInterval(send, 3000);
            } else {
                clearInterval(timer);
            }
        } else {
            console.log('received RESET ACTION');
            sensor.minTemp = sensor.temp;
            sensor.maxTemp = sensor.temp;
            sensor.startTime = Date.now();
        }
        return dcl.message.Message.buildResponseMessage(requestMessage, 200, {}, 'OK', '');
    };

    messageDispatcher.getRequestDispatcher().registerRequestHandler(id,
        'deviceModels/urn:com:oracle:iot:device:temperature_sensor/actions/reset',
        actionsHandler);

    messageDispatcher.getRequestDispatcher().registerRequestHandler(id,
        'deviceModels/urn:com:oracle:iot:device:temperature_sensor/actions/power',
        actionsHandler);

}


function deviceEnroll(device) {
    // If the user gave a hardware id for the temperature sensor,
    // then - for the purposes of this sample - the device is
    // considered to be controlled roaming. This allows the sample
    // to be run and implicitly register an ICD and have that ICD
    // be able to roam to other GatewayDeviceSamples - provided the
    // ICD has been provisioned to the gateway device's trusted assets.
    // Please refer to the documentation for registerDevice for
    // more information.

    // If the user gave a hardware id for the temperature sensor,
    // then restrict the sensor to this gateway. This means that
    // the sensor cannot be connected through other gateways.
    var temperatureSensorRestricted = process.argv.length > 4;
    var temperatureSensorHardwareId = temperatureSensorRestricted ? process.argv[4] : device.getEndpointId() + temperatureIcdId;
    device.registerDevice(temperatureSensorRestricted, temperatureSensorHardwareId, genICDDetails(temperatureSensorHardwareId),
        ['urn:com:oracle:iot:device:temperature_sensor'], function (id, error) {
        if (error) {
            console.log('----------------ERROR ON DEVICE REGISTRATION----------------');
            console.log(error.message);
            console.log('------------------------------------------------------------');
            return;
        }
        if (id) {
            console.log('------------------TEMPERATURE DEVICE------------------');
            console.log(id);
            console.log('------------------------------------------------------');
            startTemperature(device, id);
        }
    });

    // If the user gave a hardware id for the humidity sensor,
    // then restrict the sensor to this gateway. This means that
    // the sensor cannot be connected through other gateways.
    var humiditySensorRestricted = process.argv.length > 5;
    var humiditySensorHardwareId = humiditySensorRestricted ? process.argv[5] : device.getEndpointId() + humidityIcdId;
    device.registerDevice(humiditySensorRestricted, humiditySensorHardwareId, genICDDetails(humiditySensorHardwareId),
        ['urn:com:oracle:iot:device:humidity_sensor'], function (id, error) {
        if (error) {
            console.log('----------------ERROR ON DEVICE REGISTRATION----------------');
            console.log(error.message);
            console.log('------------------------------------------------------------');
            return;
        }
        if (id) {
            console.log('------------------HUMIDITY DEVICE---------------------');
            console.log(id);
            console.log('------------------------------------------------------');
            startHumidity(device, id);
        }
    });

}

var gateway = new dcl.device.util.GatewayDevice(storeFile, storePassword);
if (gateway.isActivated()) {
    deviceEnroll(gateway);
} else {
    gateway.activate([], function (device, error) {
        if (error) {
            console.log('-----------------ERROR ON ACTIVATION------------------------');
            console.log(error.message);
            console.log('------------------------------------------------------------');
            return;
        }
        gateway = device;
        console.log(gateway.isActivated());
        if (gateway.isActivated()) {
            deviceEnroll(gateway);
        }
    });
}

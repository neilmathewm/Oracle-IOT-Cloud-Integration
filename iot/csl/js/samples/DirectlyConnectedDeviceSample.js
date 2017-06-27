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
 * It uses the humidity device model for virtual device creation.
 *
 * It uses the virtual device API to update attributes, raise alerts and
 * handle attribute updates  from the server.
 *
 * The simple sensor is polled every 3 seconds and the humidity is updated
 * on the server and an alert is raised if the alert condition is met.
 *
 * The client is a directly connected device using the virtual device API.
 */

dcl = require("device-library.node");
dcl = dcl({debug: true});

var storeFile = (process.argv[2]);
var storePassword = (process.argv[3]);

var humidityModel;

function startVirtualHumidity(device, id) {
    var virtualDev = device.createVirtualDevice(id, humidityModel);

    var sensor = {
        humidity: 0
    };

    var send = function () {
        /* min threshold = 0; max threshold = 100 */
        sensor.humidity = Math.floor(Math.random() * 100);

        if ((virtualDev.maxThreshold.value !== null) && (sensor.humidity > virtualDev.maxThreshold.value)) {
            var alert = virtualDev.createAlert('urn:com:oracle:iot:device:humidity_sensor:too_humid');
            alert.fields.humidity = sensor.humidity;
            alert.raise();
            console.log("humidity ALERT: " + sensor.humidity + " higher than max " + virtualDev.maxThreshold.value);
        }
        virtualDev.update(sensor);
    };

    setInterval(send, 3000);

    virtualDev.onChange = function (tupples) {
        tupples.forEach( function (tupple) {
            var show = {
                name: tupple.attribute.id,
                lastUpdate: tupple.attribute.lastUpdate,
                oldValue: tupple.oldValue,
                newValue: tupple.newValue
            };
            console.log('------------------ON CHANGE HUMIDITY---------------------');
            console.log(JSON.stringify(show, null, 4));
            console.log('---------------------------------------------------------');
            sensor[tupple.attribute.id] = tupple.newValue;
        });
    };

    virtualDev.onError = function (tupple) {
        var show = {
            newValues: tupple.newValues,
            tryValues: tupple.tryValues,
            errorResponse: tupple.errorResponse
        };
        console.log('------------------ON ERROR HUMIDITY---------------------');
        console.log(JSON.stringify(show,null,4));
        console.log('--------------------------------------------------------');
        for (var key in tupple.newValues) {
            sensor[key] = tupple.newValues[key];
        }
    };

}

function getModelHumidity(device){
    device.getDeviceModel('urn:com:oracle:iot:device:humidity_sensor', function (response, error) {
        if (error) {
            console.log('-------------ERROR ON GET HUMIDITY DEVICE MODEL-------------');
            console.log(error.message);
            console.log('------------------------------------------------------------');
            return;
        }
        console.log('-----------------HUMIDITY DEVICE MODEL----------------------');
        console.log(JSON.stringify(response,null,4));
        console.log('------------------------------------------------------------');
        humidityModel = response;
        startVirtualHumidity(device, device.getEndpointId());
    });
}

var dcd = new dcl.device.DirectlyConnectedDevice(storeFile, storePassword);
if (dcd.isActivated()) {
    getModelHumidity(dcd);
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
            getModelHumidity(dcd);
        }
    });
}

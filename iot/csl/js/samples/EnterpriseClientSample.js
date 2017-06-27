/**
 * Copyright (c) 2015, 2016, Oracle and/or its affiliates. All rights reserved.
 *
 * This software is dual-licensed to you under the MIT License (MIT) and
 * the Universal Permissive License (UPL). See the LICENSE file in the root
 * directory for license terms. You may choose either license, or both.
 *
 */

ecl = require("enterprise-library.node");
ecl = ecl({debug: true});

var client = null;

var deviceIds = [];

models = {
    'urn:com:oracle:iot:device:humidity_sensor': null,
    'urn:com:oracle:iot:device:temperature_sensor': null
};

var cliParams = process.argv.slice(2);

var trustFile = cliParams[0];
var trustPass = cliParams[1];

var type = 0;

function showUsage(){
    console.log("Usage: \n");
    console.log("node " + process.argv[1]);
    console.log(" <trusted assets file> <trusted assets password>\n");
    console.log(" devices");
    console.log("  List all devices or all device-applications.\n");
    console.log(" <deviceId>[,<deviceId>]\n");
    console.log("  Monitor virtual device(s) & print its measurements every");
    console.log("  time it changes, until return key is pressed\n");
    console.log(" <deviceId> [reset|on|off]\n");
    console.log("  Reset the thermometer or turn on thermometer or ");
    console.log("  turn off the thermometer.\n");
    console.log(" <deviceId> <maxThreshold>\n");
    console.log("  Set the maximum threshold.\n");
    console.log(" <deviceId> <maxThreshold> <minThreshold>\n");
    console.log("  Set the maximum and minimum temperature thresholds.\n");
}

switch (cliParams.length) {
    case 3:
        switch (cliParams[2]) {
            case 'devices':
                type = 1;
                break;
            default:
                type = 11;
                break;
        }
        break;

    case 4:
        switch (cliParams[3]) {
            case 'reset':
                type = 111;
                break;
            case 'on':
                type = 112;
                break;
            case 'off':
                type = 113;
                break;
            default:
                type = 114;
                break;
        }
        break;

    case 5:
        type = 115;
        break;

    default:
        showUsage();
        return;
}

ecl.enterprise.EnterpriseClient.newClient(function (entClient, error) {
    if (error) {
        console.log('-------------ERROR ON CREATING CLIENT-----------------------');
        console.log(error.message);
        console.log('------------------------------------------------------------');
        return;
    }
    client = entClient;

    if (type < 10) {
        var finish = 0;
        var recursive;
        recursive = function (pageable, temperature, first) {
            pageable.page(first ? 'first' : 'next').then(function (response) {
                if (Array.isArray(response.items)) {
                    response.items.forEach(function (item) {
                        console.log(item.id + (temperature ? ' [Temperature Sensor]' : ' [Humidity Sensor]'))
                    });
                }
                if (response.hasMore) {
                    recursive(pageable, temperature, false);
                } else {
                    finish++;
                    if (finish === 2) {
                        client.close();
                    }
                }
            }, function (error) {
                if (error) {
                    console.log('-------------ERROR ON LISTING DEVICES-----------------------');
                    console.log(error.message);
                    console.log('------------------------------------------------------------');
                }
                client.close();
                process.exit(0);
            });
        };
        recursive(client.getActiveDevices('urn:com:oracle:iot:device:humidity_sensor'), false, true);
        recursive(client.getActiveDevices('urn:com:oracle:iot:device:temperature_sensor'), true, true);
    } else {
        deviceIds = cliParams[2].split(',');
        if (type > 100) {
            deviceIds = deviceIds.splice(0, 1);
        }
        client.getDeviceModel('urn:com:oracle:iot:device:humidity_sensor', function (response, error){
            if (error) {
                console.log('-------------ERROR ON GET HUMIDITY DEVICE MODEL-------------');
                console.log(error.message);
                console.log('------------------------------------------------------------');
                client.close();
            }
            models['urn:com:oracle:iot:device:humidity_sensor'] = response;
            client.getDeviceModel('urn:com:oracle:iot:device:temperature_sensor', function (response, error){
                if (error) {
                    console.log('-------------ERROR ON GET TEMPERATURE DEVICE MODEL----------');
                    console.log(error.message);
                    console.log('------------------------------------------------------------');
                    client.close();
                }
                models['urn:com:oracle:iot:device:temperature_sensor'] = response;
                deviceIds.forEach(function (deviceId) {
                    var filter = new ecl.enterprise.Filter();
                    filter = filter.eq('id', deviceId);
                    client.getDevices(filter).page('first').then(function (response) {
                        if (Array.isArray(response.items)
                            && response.items.length
                            && Array.isArray(response.items[0].deviceModels)
                            && response.items[0].deviceModels.length
                            && response.items[0].deviceModels[0].urn
                            && (Object.keys(models).indexOf(response.items[0].deviceModels[0].urn) > -1)) {
                            var device = client.createVirtualDevice(response.items[0].id, models[response.items[0].deviceModels[0].urn]);
                            if (type < 100) {
                                device.onChange = function (tupples) {
                                    tupples.forEach(function (tupple) {
                                        var show = {
                                            deviceId: tupple.attribute.device.getEndpointId(),
                                            attribute: tupple.attribute.id,
                                            newValue: tupple.newValue
                                        };
                                        console.log('---------------------ON CHANGE---------------------------');
                                        console.log(JSON.stringify(show, null, 4));
                                        console.log('---------------------------------------------------------');
                                    });
                                };
                                device.onAlerts = function (alertsObject) {
                                    for (var formatUrn in alertsObject) {
                                        alertsObject[formatUrn].forEach(function (object) {
                                            var show = {
                                                alert: formatUrn,
                                                fields: object.fields
                                            };
                                            console.log('---------------------ON ALERT----------------------------');
                                            console.log(JSON.stringify(show, null, 4));
                                            console.log('---------------------------------------------------------');
                                        });
                                    }
                                };
                            } else {
                                switch (type) {
                                    case 111:
                                        if (device.reset) {
                                            device.reset.onExecute = function (response) {
                                                console.log('---------------------ON RESET----------------------------');
                                                console.log(JSON.stringify(response, null, 4));
                                                console.log('---------------------------------------------------------');
                                            };
                                            device.call('reset');
                                        } else {
                                            console.log('----------------------ERROR ON ACTION--------------------');
                                            console.log('invalid model for reset action');
                                            console.log('---------------------------------------------------------');
                                        }
                                        break;
                                    case 112:
                                        if (device.power) {
                                            device.power.onExecute = function (response) {
                                                console.log('---------------------ON POWER ON-------------------------');
                                                console.log(JSON.stringify(response, null, 4));
                                                console.log('---------------------------------------------------------');
                                            };
                                            device.call('power', true);
                                        } else {
                                            console.log('----------------------ERROR ON ACTION--------------------');
                                            console.log('invalid model for power action');
                                            console.log('---------------------------------------------------------');
                                        }
                                        break;
                                    case 113:
                                        if (device.power) {
                                            device.power.onExecute = function (response) {
                                                console.log('---------------------ON POWER OFF------------------------');
                                                console.log(JSON.stringify(response, null, 4));
                                                console.log('---------------------------------------------------------');
                                                client.close();
                                            };
                                            device.call('power', false);
                                        } else {
                                            console.log('----------------------ERROR ON ACTION--------------------');
                                            console.log('invalid model for power action');
                                            console.log('---------------------------------------------------------');
                                            client.close();
                                        }
                                        break;
                                    case 114:
                                        var value = cliParams[3];
                                        if (device.maxThreshold) {
                                            device.maxThreshold.onChange = function (tupple) {
                                                var show = {
                                                    deviceId: tupple.attribute.device.getEndpointId(),
                                                    attribute: tupple.attribute.id,
                                                    newValue: tupple.newValue
                                                };
                                                console.log('---------------------ON CHANGE---------------------------');
                                                console.log(JSON.stringify(show, null, 4));
                                                console.log('---------------------------------------------------------');
                                            };
                                            device.maxThreshold.onError = function (tupple) {
                                                console.log('-----ERROR ON UPDATE ATTRIBUTE MAX THRESHOLD-------------');
                                                console.log(JSON.stringify(tupple.errorResponse, null, 4));
                                                console.log('---------------------------------------------------------');
                                            };
                                            device.maxThreshold.value = parseInt(value);
                                        } else {
                                            console.log('------------ERROR ON UPDATE ATTRIBUTE--------------------');
                                            console.log('invalid model for maxThreshold attribute');
                                            console.log('---------------------------------------------------------');
                                        }
                                        break;
                                    case 115:
                                        var max = cliParams[3];
                                        var min = cliParams[4];
                                        if (device.maxThreshold && device.minThreshold) {
                                            device.maxThreshold.onChange = function (tupple) {
                                                var show = {
                                                    deviceId: tupple.attribute.device.getEndpointId(),
                                                    attribute: tupple.attribute.id,
                                                    newValue: tupple.newValue
                                                };
                                                console.log('---------------------ON CHANGE---------------------------');
                                                console.log(JSON.stringify(show, null, 4));
                                                console.log('---------------------------------------------------------');
                                            };
                                            device.minThreshold.onChange = function (tupple) {
                                                var show = {
                                                    deviceId: tupple.attribute.device.getEndpointId(),
                                                    attribute: tupple.attribute.id,
                                                    newValue: tupple.newValue
                                                };
                                                console.log('---------------------ON CHANGE---------------------------');
                                                console.log(JSON.stringify(show, null, 4));
                                                console.log('---------------------------------------------------------');
                                            };
                                            device.maxThreshold.onError = function (tupple) {
                                                console.log('-----ERROR ON UPDATE ATTRIBUTE MAX THRESHOLD-------------');
                                                console.log(JSON.stringify(tupple.errorResponse, null, 4));
                                                console.log('---------------------------------------------------------');
                                            };
                                            device.minThreshold.onError = function (tupple) {
                                                console.log('-----ERROR ON UPDATE ATTRIBUTE MIN THRESHOLD-------------');
                                                console.log(JSON.stringify(tupple.errorResponse, null, 4));
                                                console.log('---------------------------------------------------------');
                                            };
                                            device.update({maxThreshold: parseInt(max), minThreshold: parseInt(min)});
                                        } else {
                                            console.log('------------ERROR ON UPDATE ATTRIBUTE---------------------');
                                            console.log('invalid model for maxThreshold and minThreshold attributes');
                                            console.log('----------------------------------------------------------');
                                        }
                                        break;
                                }
                            }
                        } else {
                            console.log('-------------ERROR ON GETTING DEVICE DATA-------------------');
                            console.log('invalid device or device model on device');
                            console.log('------------------------------------------------------------');
                            client.close();
                            process.exit(0);
                        }
                    }, function (response, error) {
                        if (error) {
                            console.log('-------------ERROR ON GETTING DEVICE DATA-------------------');
                            console.log(error.message);
                            console.log('------------------------------------------------------------');
                        }
                        client.close();
                        process.exit(0);
                    });
                });
                process.stdin.setRawMode(true);
                process.stdin.resume();
                process.stdin.on('data', function () {
                    client.close();
                    process.exit(0);
                });
            });
        });
    }
}, trustFile, trustPass);
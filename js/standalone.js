require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.addEndian = addEndian;
exports.readRecord = readRecord;
exports.getArrayBuffer = getArrayBuffer;
exports.calculateCRC = calculateCRC;

var _fit = require('./fit');

var _messages = require('./messages');

var _buffer = require('buffer/');

function addEndian(littleEndian, bytes) {
    var result = 0;
    if (!littleEndian) bytes.reverse();
    for (var i = 0; i < bytes.length; i++) {
        result += bytes[i] << (i << 3) >>> 0;
    }

    return result;
}

function readData(blob, fDef, startIndex, options) {
    if (fDef.endianAbility === true) {
        var temp = [];
        for (var i = 0; i < fDef.size; i++) {
            temp.push(blob[startIndex + i]);
        }

        var buffer = new Uint8Array(temp).buffer;
        var dataView = new DataView(buffer);

        try {
            switch (fDef.type) {
                case 'sint16':
                    return dataView.getInt16(0, fDef.littleEndian);
                case 'uint16':
                case 'uint16z':
                    return dataView.getUint16(0, fDef.littleEndian);
                case 'sint32':
                    return dataView.getInt32(0, fDef.littleEndian);
                case 'uint32':
                case 'uint32z':
                    return dataView.getUint32(0, fDef.littleEndian);
                case 'float32':
                    return dataView.getFloat32(0, fDef.littleEndian);
                case 'float64':
                    return dataView.getFloat64(0, fDef.littleEndian);
                case 'uint16_array':
                    var array = [];
                    for (var _i = 0; _i < fDef.size; _i += 2) {
                        array.push(dataView.getUint16(_i, fDef.littleEndian));
                    }
                    return array;
            }
        } catch (e) {
            if (!options.force) {
                throw e;
            }
        }

        return addEndian(fDef.littleEndian, temp);
    }

    if (fDef.type === 'string') {
        var _temp = [];
        for (var _i2 = 0; _i2 < fDef.size; _i2++) {
            if (blob[startIndex + _i2]) {
                _temp.push(blob[startIndex + _i2]);
            }
        }
        return new _buffer.Buffer(_temp).toString('utf-8');
    }

    if (fDef.type === 'byte_array') {
        var _temp2 = [];
        for (var _i3 = 0; _i3 < fDef.size; _i3++) {
            _temp2.push(blob[startIndex + _i3]);
        }
        return _temp2;
    }

    return blob[startIndex];
}

function formatByType(data, type, scale, offset) {
    switch (type) {
        case 'date_time':
        case 'local_date_time':
            return new Date(data * 1000 + 631065600000);
        case 'sint32':
            return data * _fit.FIT.scConst;
        case 'sint16':
        case 'uint32':
        case 'uint16':
            return scale ? data / scale + offset : data;
        case 'uint16_array':
            return data.map(function (dataItem) {
                return scale ? dataItem / scale + offset : dataItem;
            });
        default:
            if (!_fit.FIT.types[type]) {
                return data;
            }
            // Quick check for a mask
            var values = [];
            for (var key in _fit.FIT.types[type]) {
                if (_fit.FIT.types[type].hasOwnProperty(key)) {
                    values.push(_fit.FIT.types[type][key]);
                }
            }
            if (values.indexOf('mask') === -1) {
                return _fit.FIT.types[type][data];
            }
            var dataItem = {};
            for (var key in _fit.FIT.types[type]) {
                if (_fit.FIT.types[type].hasOwnProperty(key)) {
                    if (_fit.FIT.types[type][key] === 'mask') {
                        dataItem.value = data & key;
                    } else {
                        dataItem[_fit.FIT.types[type][key]] = !!((data & key) >> 7); // Not sure if we need the >> 7 and casting to boolean but from all the masked props of fields so far this seems to be the case
                    }
                }
            }
            return dataItem;
    }
}

function isInvalidValue(data, type) {
    switch (type) {
        case 'enum':
            return data === 0xFF;
        case 'sint8':
            return data === 0x7F;
        case 'uint8':
            return data === 0xFF;
        case 'sint16':
            return data === 0x7FFF;
        case 'uint16':
            return data === 0xFFFF;
        case 'sint32':
            return data === 0x7FFFFFFF;
        case 'uint32':
            return data === 0xFFFFFFFF;
        case 'string':
            return data === 0x00;
        case 'float32':
            return data === 0xFFFFFFFF;
        case 'float64':
            return data === 0xFFFFFFFFFFFFFFFF;
        case 'uint8z':
            return data === 0x00;
        case 'uint16z':
            return data === 0x0000;
        case 'uint32z':
            return data === 0x000000;
        case 'byte':
            return data === 0xFF;
        case 'sint64':
            return data === 0x7FFFFFFFFFFFFFFF;
        case 'uint64':
            return data === 0xFFFFFFFFFFFFFFFF;
        case 'uint64z':
            return data === 0x0000000000000000;
        default:
            return false;
    }
}

function convertTo(data, unitsList, speedUnit) {
    var unitObj = _fit.FIT.options[unitsList][speedUnit];
    return unitObj ? data * unitObj.multiplier + unitObj.offset : data;
}

function applyOptions(data, field, options) {
    switch (field) {
        case 'speed':
        case 'enhanced_speed':
        case 'vertical_speed':
        case 'avg_speed':
        case 'max_speed':
        case 'speed_1s':
        case 'ball_speed':
        case 'enhanced_avg_speed':
        case 'enhanced_max_speed':
        case 'avg_pos_vertical_speed':
        case 'max_pos_vertical_speed':
        case 'avg_neg_vertical_speed':
        case 'max_neg_vertical_speed':
            return convertTo(data, 'speedUnits', options.speedUnit);
        case 'distance':
        case 'total_distance':
        case 'enhanced_avg_altitude':
        case 'enhanced_min_altitude':
        case 'enhanced_max_altitude':
        case 'enhanced_altitude':
        case 'height':
        case 'odometer':
        case 'avg_stroke_distance':
        case 'min_altitude':
        case 'avg_altitude':
        case 'max_altitude':
        case 'total_ascent':
        case 'total_descent':
        case 'altitude':
        case 'cycle_length':
        case 'auto_wheelsize':
        case 'custom_wheelsize':
        case 'gps_accuracy':
            return convertTo(data, 'lengthUnits', options.lengthUnit);
        case 'temperature':
        case 'avg_temperature':
        case 'max_temperature':
            return convertTo(data, 'temperatureUnits', options.temperatureUnit);
        default:
            return data;
    }
}

function readRecord(blob, messageTypes, developerFields, startIndex, options, startDate, pausedTime) {
    var recordHeader = blob[startIndex];
    var localMessageType = recordHeader & 15;

    if ((recordHeader & 64) === 64) {
        // is definition message
        // startIndex + 1 is reserved

        var hasDeveloperData = (recordHeader & 32) === 32;
        var lEnd = blob[startIndex + 2] === 0;
        var numberOfFields = blob[startIndex + 5];
        var numberOfDeveloperDataFields = hasDeveloperData ? blob[startIndex + 5 + numberOfFields * 3 + 1] : 0;

        var mTypeDef = {
            littleEndian: lEnd,
            globalMessageNumber: addEndian(lEnd, [blob[startIndex + 3], blob[startIndex + 4]]),
            numberOfFields: numberOfFields + numberOfDeveloperDataFields,
            fieldDefs: []
        };

        var _message = (0, _messages.getFitMessage)(mTypeDef.globalMessageNumber);

        for (var i = 0; i < numberOfFields; i++) {
            var fDefIndex = startIndex + 6 + i * 3;
            var baseType = blob[fDefIndex + 2];

            var _message$getAttribute = _message.getAttributes(blob[fDefIndex]),
                field = _message$getAttribute.field,
                type = _message$getAttribute.type;

            var fDef = {
                type: type,
                fDefNo: blob[fDefIndex],
                size: blob[fDefIndex + 1],
                endianAbility: (baseType & 128) === 128,
                littleEndian: lEnd,
                baseTypeNo: baseType & 15,
                name: field,
                dataType: (0, _messages.getFitMessageBaseType)(baseType & 15)
            };

            mTypeDef.fieldDefs.push(fDef);
        }

        for (var _i4 = 0; _i4 < numberOfDeveloperDataFields; _i4++) {
            // If we fail to parse then try catch
            try {
                var _fDefIndex = startIndex + 6 + numberOfFields * 3 + 1 + _i4 * 3;

                var fieldNum = blob[_fDefIndex];
                var size = blob[_fDefIndex + 1];
                var devDataIndex = blob[_fDefIndex + 2];

                var devDef = developerFields[devDataIndex][fieldNum];

                var _baseType = devDef.fit_base_type_id;

                var _fDef = {
                    type: _fit.FIT.types.fit_base_type[_baseType],
                    fDefNo: fieldNum,
                    size: size,
                    endianAbility: (_baseType & 128) === 128,
                    littleEndian: lEnd,
                    baseTypeNo: _baseType & 15,
                    name: devDef.field_name,
                    dataType: (0, _messages.getFitMessageBaseType)(_baseType & 15),
                    scale: devDef.scale || 1,
                    offset: devDef.offset || 0,
                    developerDataIndex: devDataIndex,
                    isDeveloperField: true
                };

                mTypeDef.fieldDefs.push(_fDef);
            } catch (e) {
                if (options.force) {
                    continue;
                }
                throw e;
            }
        }

        messageTypes[localMessageType] = mTypeDef;

        var nextIndex = startIndex + 6 + mTypeDef.numberOfFields * 3;
        var nextIndexWithDeveloperData = nextIndex + 1;

        return {
            messageType: 'definition',
            nextIndex: hasDeveloperData ? nextIndexWithDeveloperData : nextIndex
        };
    }

    var messageType = messageTypes[localMessageType] || messageTypes[0];

    // TODO: handle compressed header ((recordHeader & 128) == 128)

    // uncompressed header
    var messageSize = 0;
    var readDataFromIndex = startIndex + 1;
    var fields = {};
    var message = (0, _messages.getFitMessage)(messageType.globalMessageNumber);

    for (var _i5 = 0; _i5 < messageType.fieldDefs.length; _i5++) {
        var _fDef2 = messageType.fieldDefs[_i5];
        var data = readData(blob, _fDef2, readDataFromIndex, options);

        if (!isInvalidValue(data, _fDef2.type)) {
            if (_fDef2.isDeveloperField) {

                var field = _fDef2.name;
                var type = _fDef2.type;
                var scale = _fDef2.scale;
                var offset = _fDef2.offset;

                fields[_fDef2.name] = applyOptions(formatByType(data, type, scale, offset), field, options);
            } else {
                var _message$getAttribute2 = message.getAttributes(_fDef2.fDefNo),
                    _field = _message$getAttribute2.field,
                    _type = _message$getAttribute2.type,
                    _scale = _message$getAttribute2.scale,
                    _offset = _message$getAttribute2.offset;

                if (_field !== 'unknown' && _field !== '' && _field !== undefined) {
                    fields[_field] = applyOptions(formatByType(data, _type, _scale, _offset), _field, options);
                }
            }

            if (message.name === 'record' && options.elapsedRecordField) {
                fields.elapsed_time = (fields.timestamp - startDate) / 1000;
                fields.timer_time = fields.elapsed_time - pausedTime;
            }
        }

        readDataFromIndex += _fDef2.size;
        messageSize += _fDef2.size;
    }

    if (message.name === 'field_description') {
        developerFields[fields.developer_data_index] = developerFields[fields.developer_data_index] || [];
        developerFields[fields.developer_data_index][fields.field_definition_number] = fields;
    }

    var result = {
        messageType: message.name,
        nextIndex: startIndex + messageSize + 1,
        message: fields
    };

    return result;
}

function getArrayBuffer(buffer) {
    if (buffer instanceof ArrayBuffer) {
        return buffer;
    }
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}

function calculateCRC(blob, start, end) {
    var crcTable = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401, 0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];

    var crc = 0;
    for (var i = start; i < end; i++) {
        var byte = blob[i];
        var tmp = crcTable[crc & 0xF];
        crc = crc >> 4 & 0x0FFF;
        crc = crc ^ tmp ^ crcTable[byte & 0xF];
        tmp = crcTable[crc & 0xF];
        crc = crc >> 4 & 0x0FFF;
        crc = crc ^ tmp ^ crcTable[byte >> 4 & 0xF];
    }

    return crc;
}
},{"./fit":2,"./messages":3,"buffer/":5}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getMessageName = getMessageName;
exports.getFieldObject = getFieldObject;
var FIT = exports.FIT = {
  scConst: 180 / Math.pow(2, 31),
  options: {
    speedUnits: {
      mph: {
        multiplier: 3.6 / 1.4,
        offset: 0
      },
      'km/h': {
        multiplier: 3.6,
        offset: 0
      }
    },
    lengthUnits: {
      mi: {
        multiplier: 1 / 1609.344,
        offset: 0
      },
      km: {
        multiplier: 1 / 1000,
        offset: 0
      }
    },
    temperatureUnits: {
      kelvin: {
        multiplier: 1,
        offset: -273.15
      },
      fahrenheit: {
        multiplier: 9 / 5,
        offset: 32
      }
    }
  },
  messages: {
    0: {
      name: 'file_id',
      0: { field: 'type', type: 'file', scale: null, offset: '', units: '' },
      1: { field: 'manufacturer', type: 'manufacturer', scale: null, offset: '', units: '' },
      2: { field: 'product', type: 'uint16', scale: null, offset: '', units: '' },
      3: { field: 'serial_number', type: 'uint32z', scale: null, offset: '', units: '' },
      4: { field: 'time_created', type: 'date_time', scale: null, offset: '', units: '' },
      5: { field: 'number', type: 'uint16', scale: null, offset: '', units: '' },
      8: { field: 'product_name', type: 'string', scale: null, offset: '', units: '' }
    },
    1: {
      name: 'capabilities',
      0: { field: 'languages', type: 'uint8z', scale: null, offset: '', units: '' },
      1: { field: 'sports', type: 'sport_bits_0', scale: null, offset: '', units: '' },
      21: { field: 'workouts_supported', type: 'workout_capabilities', scale: null, offset: '', units: '' },
      23: { field: 'connectivity_supported', type: 'connectivity_capabilities', scale: null, offset: '', units: '' }
    },
    2: {
      name: 'device_settings',
      0: { field: 'active_time_zone', type: 'uint8', scale: null, offset: '', units: '' },
      1: { field: 'utc_offset', type: 'uint32', scale: null, offset: '', units: '' },
      2: { field: 'time_offset', type: 'uint32', scale: null, offset: '', units: 's' },
      5: { field: 'time_zone_offset', type: 'sint8', scale: 4, offset: '', units: 'hr' },
      55: { field: 'display_orientation', type: 'display_orientation', scale: null, offset: '', units: '' },
      56: { field: 'mounting_side', type: 'side', scale: null, offset: '', units: '' },
      94: { field: 'number_of_screens', type: 'uint8', scale: null, offset: '', units: '' },
      95: { field: 'smart_notification_display_orientation', type: 'display_orientation', scale: null, offset: '', units: '' }
    },
    3: {
      name: 'user_profile',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      0: { field: 'friendly_name', type: 'string', scale: null, offset: 0, units: '' },
      1: { field: 'gender', type: 'gender', scale: null, offset: 0, units: '' },
      2: { field: 'age', type: 'uint8', scale: null, offset: 0, units: 'years' },
      3: { field: 'height', type: 'uint8', scale: 100, offset: 0, units: 'm' },
      4: { field: 'weight', type: 'uint16', scale: 10, offset: 0, units: 'kg' },
      5: { field: 'language', type: 'language', scale: null, offset: 0, units: '' },
      6: { field: 'elev_setting', type: 'display_measure', scale: null, offset: 0, units: '' },
      7: { field: 'weight_setting', type: 'display_measure', scale: null, offset: 0, units: '' },
      8: { field: 'resting_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      9: { field: 'default_max_running_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      10: { field: 'default_max_biking_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      11: { field: 'default_max_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      12: { field: 'hr_setting', type: 'display_heart', scale: null, offset: 0, units: '' },
      13: { field: 'speed_setting', type: 'display_measure', scale: null, offset: 0, units: '' },
      14: { field: 'dist_setting', type: 'display_measure', scale: null, offset: 0, units: '' },
      16: { field: 'power_setting', type: 'display_power', scale: null, offset: 0, units: '' },
      17: { field: 'activity_class', type: 'activity_class', scale: null, offset: 0, units: '' },
      18: { field: 'position_setting', type: 'display_position', scale: null, offset: 0, units: '' },
      21: { field: 'temperature_setting', type: 'display_measure', scale: null, offset: 0, units: '' },
      22: { field: 'local_id', type: 'user_local_id', scale: null, offset: 0, units: '' },
      23: { field: 'global_id', type: 'byte', scale: null, offset: 0, units: '' },
      30: { field: 'height_setting', type: 'display_measure', scale: null, offset: 0, units: '' }
    },
    4: {
      name: 'hrm_profile',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: '', units: '' },
      0: { field: 'enabled', type: 'bool', scale: null, offset: '', units: '' },
      1: { field: 'hrm_ant_id', type: 'uint16z', scale: null, offset: '', units: '' },
      2: { field: 'log_hrv', type: 'bool', scale: null, offset: '', units: '' },
      3: { field: 'hrm_ant_id_trans_type', type: 'uint8z', scale: null, offset: '', units: '' }
    },
    5: {
      name: 'sdm_profile',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: '', units: '' },
      0: { field: 'enabled', type: 'bool', scale: null, offset: '', units: '' },
      1: { field: 'sdm_ant_id', type: 'uint16z', scale: null, offset: '', units: '' },
      2: { field: 'sdm_cal_factor', type: 'uint16', scale: 10, offset: '', units: '%' },
      3: { field: 'odometer', type: 'uint32', scale: 100, offset: '', units: 'm' },
      4: { field: 'speed_source', type: 'bool', scale: null, offset: '', units: '' },
      5: { field: 'sdm_ant_id_trans_type', type: 'uint8z', scale: null, offset: '', units: '' },
      7: { field: 'odometer_rollover', type: 'uint8', scale: null, offset: '', units: '' }
    },
    6: {
      name: 'bike_profile',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      0: { field: 'name', type: 'string', scale: null, offset: 0, units: '' },
      1: { field: 'sport', type: 'sport', scale: null, offset: 0, units: '' },
      2: { field: 'sub_sport', type: 'sub_sport', scale: null, offset: 0, units: '' },
      3: { field: 'odometer', type: 'uint32', scale: 100, offset: 0, units: 'm' },
      4: { field: 'bike_spd_ant_id', type: 'uint16z', scale: null, offset: 0, units: '' },
      5: { field: 'bike_cad_ant_id', type: 'uint16z', scale: null, offset: 0, units: '' },
      6: { field: 'bike_spdcad_ant_id', type: 'uint16z', scale: null, offset: 0, units: '' },
      7: { field: 'bike_power_ant_id', type: 'uint16z', scale: null, offset: 0, units: '' },
      8: { field: 'custom_wheelsize', type: 'uint16', scale: 1000, offset: 0, units: 'm' },
      9: { field: 'auto_wheelsize', type: 'uint16', scale: 1000, offset: 0, units: 'm' },
      10: { field: 'bike_weight', type: 'uint16', scale: 10, offset: 0, units: 'kg' },
      11: { field: 'power_cal_factor', type: 'uint16', scale: 10, offset: 0, units: '%' },
      12: { field: 'auto_wheel_cal', type: 'bool', scale: null, offset: 0, units: '' },
      13: { field: 'auto_power_zero', type: 'bool', scale: null, offset: 0, units: '' },
      14: { field: 'id', type: 'uint8', scale: null, offset: 0, units: '' },
      15: { field: 'spd_enabled', type: 'bool', scale: null, offset: 0, units: '' },
      16: { field: 'cad_enabled', type: 'bool', scale: null, offset: 0, units: '' },
      17: { field: 'spdcad_enabled', type: 'bool', scale: null, offset: 0, units: '' },
      18: { field: 'power_enabled', type: 'bool', scale: null, offset: 0, units: '' },
      19: { field: 'crank_length', type: 'uint8', scale: 2, offset: -110, units: 'mm' },
      20: { field: 'enabled', type: 'bool', scale: null, offset: 0, units: '' },
      21: { field: 'bike_spd_ant_id_trans_type', type: 'uint8z', scale: null, offset: 0, units: '' },
      22: { field: 'bike_cad_ant_id_trans_type', type: 'uint8z', scale: null, offset: 0, units: '' },
      23: { field: 'bike_spdcad_ant_id_trans_type', type: 'uint8z', scale: null, offset: 0, units: '' },
      24: { field: 'bike_power_ant_id_trans_type', type: 'uint8z', scale: null, offset: 0, units: '' },
      37: { field: 'odometer_rollover', type: 'uint8', scale: null, offset: 0, units: '' },
      38: { field: 'front_gear_num', type: 'uint8z', scale: null, offset: 0, units: '' },
      39: { field: 'front_gear', type: 'uint8z', scale: null, offset: 0, units: '' },
      40: { field: 'rear_gear_num', type: 'uint8z', scale: null, offset: 0, units: '' },
      41: { field: 'rear_gear', type: 'uint8z', scale: null, offset: 0, units: '' },
      44: { field: 'shimano_di2_enabled', type: 'bool', scale: null, offset: 0, units: '' }
    },
    7: {
      name: 'zones_target',
      1: { field: 'max_heart_rate', type: 'uint8', scale: null, offset: '', units: '' },
      2: { field: 'threshold_heart_rate', type: 'uint8', scale: null, offset: '', units: '' },
      3: { field: 'functional_threshold_power', type: 'uint16', scale: null, offset: '', units: '' },
      5: { field: 'hr_calc_type', type: 'hr_zone_calc', scale: null, offset: '', units: '' },
      7: { field: 'pwr_calc_type', type: 'pwr_zone_calc', scale: null, offset: '', units: '' }
    },
    8: {
      name: 'hr_zone',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      1: { field: 'high_bpm', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      2: { field: 'name', type: 'string', scale: null, offset: 0, units: '' }
    },
    9: {
      name: 'power_zone',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      1: { field: 'high_value', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      2: { field: 'name', type: 'string', scale: null, offset: 0, units: '' }
    },
    10: {
      name: 'met_zone',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      1: { field: 'high_bpm', type: 'uint8', scale: null, offset: 0, units: '' },
      2: { field: 'calories', type: 'uint16', scale: 10, offset: 0, units: 'kcal / min' },
      3: { field: 'fat_calories', type: 'uint8', scale: 10, offset: 0, units: 'kcal / min' }
    },
    12: {
      name: 'sport',
      0: { field: 'sport', type: 'sport', scale: null, offset: '', units: '' },
      1: { field: 'sub_sport', type: 'sub_sport', scale: null, offset: '', units: '' },
      3: { field: 'name', type: 'string', scale: null, offset: '', units: '' }
    },
    15: {
      name: 'goal',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: '', units: '' },
      0: { field: 'sport', type: 'sport', scale: null, offset: '', units: '' },
      1: { field: 'sub_sport', type: 'sub_sport', scale: null, offset: '', units: '' },
      2: { field: 'start_date', type: 'date_time', scale: null, offset: '', units: '' },
      3: { field: 'end_date', type: 'date_time', scale: null, offset: '', units: '' },
      4: { field: 'type', type: 'goal', scale: null, offset: '', units: '' },
      5: { field: 'value', type: 'uint32', scale: null, offset: '', units: '' },
      6: { field: 'repeat', type: 'bool', scale: null, offset: '', units: '' },
      7: { field: 'target_value', type: 'uint32', scale: null, offset: '', units: '' },
      8: { field: 'recurrence', type: 'goal_recurrence', scale: null, offset: '', units: '' },
      9: { field: 'recurrence_value', type: 'uint16', scale: null, offset: '', units: '' },
      10: { field: 'enabled', type: 'bool', scale: null, offset: '', units: '' }
    },
    18: {
      name: 'session',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: 's' },
      0: { field: 'event', type: 'event', scale: null, offset: 0, units: '' },
      1: { field: 'event_type', type: 'event_type', scale: null, offset: 0, units: '' },
      2: { field: 'start_time', type: 'date_time', scale: null, offset: 0, units: '' },
      3: { field: 'start_position_lat', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      4: { field: 'start_position_long', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      5: { field: 'sport', type: 'sport', scale: null, offset: 0, units: '' },
      6: { field: 'sub_sport', type: 'sub_sport', scale: null, offset: 0, units: '' },
      7: { field: 'total_elapsed_time', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      8: { field: 'total_timer_time', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      9: { field: 'total_distance', type: 'uint32', scale: 100, offset: 0, units: 'm' },
      10: { field: 'total_cycles', type: 'uint32', scale: null, offset: 0, units: 'cycles' },
      11: { field: 'total_calories', type: 'uint16', scale: null, offset: 0, units: 'kcal' },
      13: { field: 'total_fat_calories', type: 'uint16', scale: null, offset: 0, units: 'kcal' },
      14: { field: 'avg_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      15: { field: 'max_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      16: { field: 'avg_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      17: { field: 'max_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      18: { field: 'avg_cadence', type: 'uint8', scale: null, offset: 0, units: 'rpm' },
      19: { field: 'max_cadence', type: 'uint8', scale: null, offset: 0, units: 'rpm' },
      20: { field: 'avg_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      21: { field: 'max_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      22: { field: 'total_ascent', type: 'uint16', scale: null, offset: 0, units: 'm' },
      23: { field: 'total_descent', type: 'uint16', scale: null, offset: 0, units: 'm' },
      24: { field: 'total_training_effect', type: 'uint8', scale: 10, offset: 0, units: '' },
      25: { field: 'first_lap_index', type: 'uint16', scale: null, offset: 0, units: '' },
      26: { field: 'num_laps', type: 'uint16', scale: null, offset: 0, units: '' },
      27: { field: 'event_group', type: 'uint8', scale: null, offset: 0, units: '' },
      28: { field: 'trigger', type: 'session_trigger', scale: null, offset: 0, units: '' },
      29: { field: 'nec_lat', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      30: { field: 'nec_long', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      31: { field: 'swc_lat', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      32: { field: 'swc_long', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      34: { field: 'normalized_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      35: { field: 'training_stress_score', type: 'uint16', scale: 10, offset: 0, units: 'tss' },
      36: { field: 'intensity_factor', type: 'uint16', scale: 1000, offset: 0, units: 'if' },
      37: { field: 'left_right_balance', type: 'left_right_balance_100', scale: 100, offset: 0, units: '%' },
      41: { field: 'avg_stroke_count', type: 'uint32', scale: 10, offset: 0, units: 'strokes/lap' },
      42: { field: 'avg_stroke_distance', type: 'uint16', scale: 100, offset: 0, units: 'm' },
      43: { field: 'swim_stroke', type: 'swim_stroke', scale: null, offset: 0, units: 'swim_stroke' },
      44: { field: 'pool_length', type: 'uint16', scale: 100, offset: 0, units: 'm' },
      45: { field: 'threshold_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      46: { field: 'pool_length_unit', type: 'display_measure', scale: null, offset: 0, units: '' },
      47: { field: 'num_active_lengths', type: 'uint16', scale: null, offset: 0, units: 'lengths' },
      48: { field: 'total_work', type: 'uint32', scale: null, offset: 0, units: 'J' },
      49: { field: 'avg_altitude', type: 'uint16', scale: 5, offset: -500, units: 'm' },
      50: { field: 'max_altitude', type: 'uint16', scale: 5, offset: -500, units: 'm' },
      51: { field: 'gps_accuracy', type: 'uint8', scale: null, offset: 0, units: 'm' },
      52: { field: 'avg_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      53: { field: 'avg_pos_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      54: { field: 'avg_neg_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      55: { field: 'max_pos_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      56: { field: 'max_neg_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      57: { field: 'avg_temperature', type: 'sint8', scale: null, offset: 0, units: 'C' },
      58: { field: 'max_temperature', type: 'sint8', scale: null, offset: 0, units: 'C' },
      59: { field: 'total_moving_time', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      60: { field: 'avg_pos_vertical_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      61: { field: 'avg_neg_vertical_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      62: { field: 'max_pos_vertical_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      63: { field: 'max_neg_vertical_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      64: { field: 'min_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      65: { field: 'time_in_hr_zone', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      66: { field: 'time_in_speed_zone', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      67: { field: 'time_in_cadence_zone', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      68: { field: 'time_in_power_zone', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      69: { field: 'avg_lap_time', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      70: { field: 'best_lap_index', type: 'uint16', scale: null, offset: 0, units: '' },
      71: { field: 'min_altitude', type: 'uint16', scale: 5, offset: -500, units: 'm' },
      82: { field: 'player_score', type: 'uint16', scale: null, offset: 0, units: '' },
      83: { field: 'opponent_score', type: 'uint16', scale: null, offset: 0, units: '' },
      84: { field: 'opponent_name', type: 'string', scale: null, offset: 0, units: '' },
      85: { field: 'stroke_count', type: 'uint16', scale: null, offset: 0, units: 'counts' },
      86: { field: 'zone_count', type: 'uint16', scale: null, offset: 0, units: 'counts' },
      87: { field: 'max_ball_speed', type: 'uint16', scale: 100, offset: 0, units: 'm/s' },
      88: { field: 'avg_ball_speed', type: 'uint16', scale: 100, offset: 0, units: 'm/s' },
      89: { field: 'avg_vertical_oscillation', type: 'uint16', scale: 10, offset: 0, units: 'mm' },
      90: { field: 'avg_stance_time_percent', type: 'uint16', scale: 100, offset: 0, units: 'percent' },
      91: { field: 'avg_stance_time', type: 'uint16', scale: 10, offset: 0, units: 'ms' },
      92: { field: 'avg_fractional_cadence', type: 'uint8', scale: 128, offset: 0, units: 'rpm' },
      93: { field: 'max_fractional_cadence', type: 'uint8', scale: 128, offset: 0, units: 'rpm' },
      94: { field: 'total_fractional_cycles', type: 'uint8', scale: 128, offset: 0, units: 'cycles' },
      95: { field: 'avg_total_hemoglobin_conc', type: 'uint16', scale: 100, offset: 0, units: 'g/dL' },
      96: { field: 'min_total_hemoglobin_conc', type: 'uint16', scale: 100, offset: 0, units: 'g/dL' },
      97: { field: 'max_total_hemoglobin_conc', type: 'uint16', scale: 100, offset: 0, units: 'g/dL' },
      98: { field: 'avg_saturated_hemoglobin_percent', type: 'uint16', scale: 10, offset: 0, units: '%' },
      99: { field: 'min_saturated_hemoglobin_percent', type: 'uint16', scale: 10, offset: 0, units: '%' },
      100: { field: 'max_saturated_hemoglobin_percent', type: 'uint16', scale: 10, offset: 0, units: '%' },
      101: { field: 'avg_left_torque_effectiveness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      102: { field: 'avg_right_torque_effectiveness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      103: { field: 'avg_left_pedal_smoothness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      104: { field: 'avg_right_pedal_smoothness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      105: { field: 'avg_combined_pedal_smoothness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      111: { field: 'sport_index', type: 'uint8', scale: null, offset: 0, units: '' },
      112: { field: 'time_standing', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      113: { field: 'stand_count', type: 'uint16', scale: null, offset: 0, units: '' },
      114: { field: 'avg_left_pco', type: 'sint8', scale: null, offset: 0, units: 'mm' },
      115: { field: 'avg_right_pco', type: 'sint8', scale: null, offset: 0, units: 'mm' },
      116: { field: 'avg_left_power_phase', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      117: { field: 'avg_left_power_phase_peak', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      118: { field: 'avg_right_power_phase', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      119: { field: 'avg_right_power_phase_peak', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      120: { field: 'avg_power_position', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      121: { field: 'max_power_position', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      122: { field: 'avg_cadence_position', type: 'uint8', scale: null, offset: 0, units: 'rpm' },
      123: { field: 'max_cadence_position', type: 'uint8', scale: null, offset: 0, units: 'rpm' },
      124: { field: 'enhanced_avg_speed', type: 'uint32', scale: 1000, offset: 0, units: 'm/s' },
      125: { field: 'enhanced_max_speed', type: 'uint32', scale: 1000, offset: 0, units: 'm/s' },
      126: { field: 'enhanced_avg_altitude', type: 'uint32', scale: 5, offset: -500, units: 'm' },
      127: { field: 'enhanced_min_altitude', type: 'uint32', scale: 5, offset: -500, units: 'm' },
      128: { field: 'enhanced_max_altitude', type: 'uint32', scale: 5, offset: -500, units: 'm' },
      129: { field: 'avg_lev_motor_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      130: { field: 'max_lev_motor_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      131: { field: 'lev_battery_consumption', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      132: { field: 'avg_vertical_ratio', type: 'uint16', scale: 100, offset: 0, units: 'percent' },
      133: { field: 'avg_stance_time_balance', type: 'uint16', scale: 100, offset: 0, units: 'percent' },
      134: { field: 'avg_step_length', type: 'uint16', scale: 10, offset: 0, units: 'mm' },
      137: { field: 'total_anaerobic_effect', type: 'uint8', scale: 10, offset: 0, units: '' },
      139: { field: 'avg_vam', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' }
    },
    19: {
      name: 'lap',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: 's' },
      0: { field: 'event', type: 'event', scale: null, offset: 0, units: '' },
      1: { field: 'event_type', type: 'event_type', scale: null, offset: 0, units: '' },
      2: { field: 'start_time', type: 'date_time', scale: null, offset: 0, units: '' },
      3: { field: 'start_position_lat', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      4: { field: 'start_position_long', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      5: { field: 'end_position_lat', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      6: { field: 'end_position_long', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      7: { field: 'total_elapsed_time', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      8: { field: 'total_timer_time', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      9: { field: 'total_distance', type: 'uint32', scale: 100, offset: 0, units: 'm' },
      10: { field: 'total_cycles', type: 'uint32', scale: null, offset: 0, units: 'cycles' },
      11: { field: 'total_calories', type: 'uint16', scale: null, offset: 0, units: 'kcal' },
      12: { field: 'total_fat_calories', type: 'uint16', scale: null, offset: 0, units: 'kcal' },
      13: { field: 'avg_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      14: { field: 'max_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      15: { field: 'avg_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      16: { field: 'max_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      17: { field: 'avg_cadence', type: 'uint8', scale: null, offset: 0, units: 'rpm' },
      18: { field: 'max_cadence', type: 'uint8', scale: null, offset: 0, units: 'rpm' },
      19: { field: 'avg_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      20: { field: 'max_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      21: { field: 'total_ascent', type: 'uint16', scale: null, offset: 0, units: 'm' },
      22: { field: 'total_descent', type: 'uint16', scale: null, offset: 0, units: 'm' },
      23: { field: 'intensity', type: 'intensity', scale: null, offset: 0, units: '' },
      24: { field: 'lap_trigger', type: 'lap_trigger', scale: null, offset: 0, units: '' },
      25: { field: 'sport', type: 'sport', scale: null, offset: 0, units: '' },
      26: { field: 'event_group', type: 'uint8', scale: null, offset: 0, units: '' },
      32: { field: 'num_lengths', type: 'uint16', scale: null, offset: 0, units: 'lengths' },
      33: { field: 'normalized_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      34: { field: 'left_right_balance', type: 'left_right_balance_100', scale: 100, offset: 0, units: '%' },
      35: { field: 'first_length_index', type: 'uint16', scale: null, offset: 0, units: '' },
      37: { field: 'avg_stroke_distance', type: 'uint16', scale: 100, offset: 0, units: 'm' },
      38: { field: 'swim_stroke', type: 'swim_stroke', scale: null, offset: 0, units: '' },
      39: { field: 'sub_sport', type: 'sub_sport', scale: null, offset: 0, units: '' },
      40: { field: 'num_active_lengths', type: 'uint16', scale: null, offset: 0, units: 'lengths' },
      41: { field: 'total_work', type: 'uint32', scale: null, offset: 0, units: 'J' },
      42: { field: 'avg_altitude', type: 'uint16', scale: 5, offset: -500, units: 'm' },
      43: { field: 'max_altitude', type: 'uint16', scale: 5, offset: -500, units: 'm' },
      44: { field: 'gps_accuracy', type: 'uint8', scale: null, offset: 0, units: 'm' },
      45: { field: 'avg_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      46: { field: 'avg_pos_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      47: { field: 'avg_neg_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      48: { field: 'max_pos_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      49: { field: 'max_neg_grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      50: { field: 'avg_temperature', type: 'sint8', scale: null, offset: 0, units: 'C' },
      51: { field: 'max_temperature', type: 'sint8', scale: null, offset: 0, units: 'C' },
      52: { field: 'total_moving_time', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      53: { field: 'avg_pos_vertical_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      54: { field: 'avg_neg_vertical_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      55: { field: 'max_pos_vertical_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      56: { field: 'max_neg_vertical_speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      57: { field: 'time_in_hr_zone', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      58: { field: 'time_in_speed_zone', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      59: { field: 'time_in_cadence_zone', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      60: { field: 'time_in_power_zone', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      61: { field: 'repetition_num', type: 'uint16', scale: null, offset: 0, units: '' },
      62: { field: 'min_altitude', type: 'uint16', scale: 5, offset: -500, units: 'm' },
      63: { field: 'min_heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      71: { field: 'wkt_step_index', type: 'message_index', scale: null, offset: 0, units: '' },
      74: { field: 'opponent_score', type: 'uint16', scale: null, offset: 0, units: '' },
      75: { field: 'stroke_count', type: 'uint16', scale: null, offset: 0, units: 'counts' },
      76: { field: 'zone_count', type: 'uint16', scale: null, offset: 0, units: 'counts' },
      77: { field: 'avg_vertical_oscillation', type: 'uint16', scale: 10, offset: 0, units: 'mm' },
      78: { field: 'avg_stance_time_percent', type: 'uint16', scale: 100, offset: 0, units: 'percent' },
      79: { field: 'avg_stance_time', type: 'uint16', scale: 10, offset: 0, units: 'ms' },
      80: { field: 'avg_fractional_cadence', type: 'uint8', scale: 128, offset: 0, units: 'rpm' },
      81: { field: 'max_fractional_cadence', type: 'uint8', scale: 128, offset: 0, units: 'rpm' },
      82: { field: 'total_fractional_cycles', type: 'uint8', scale: 128, offset: 0, units: 'cycles' },
      83: { field: 'player_score', type: 'uint16', scale: null, offset: 0, units: '' },
      84: { field: 'avg_total_hemoglobin_conc', type: 'uint16', scale: 100, offset: 0, units: 'g/dL' },
      85: { field: 'min_total_hemoglobin_conc', type: 'uint16', scale: 100, offset: 0, units: 'g/dL' },
      86: { field: 'max_total_hemoglobin_conc', type: 'uint16', scale: 100, offset: 0, units: 'g/dL' },
      87: { field: 'avg_saturated_hemoglobin_percent', type: 'uint16', scale: 10, offset: 0, units: '%' },
      88: { field: 'min_saturated_hemoglobin_percent', type: 'uint16', scale: 10, offset: 0, units: '%' },
      89: { field: 'max_saturated_hemoglobin_percent', type: 'uint16', scale: 10, offset: 0, units: '%' },
      91: { field: 'avg_left_torque_effectiveness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      92: { field: 'avg_right_torque_effectiveness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      93: { field: 'avg_left_pedal_smoothness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      94: { field: 'avg_right_pedal_smoothness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      95: { field: 'avg_combined_pedal_smoothness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      98: { field: 'time_standing', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      99: { field: 'stand_count', type: 'uint16', scale: null, offset: 0, units: '' },
      100: { field: 'avg_left_pco', type: 'sint8', scale: null, offset: 0, units: 'mm' },
      101: { field: 'avg_right_pco', type: 'sint8', scale: null, offset: 0, units: 'mm' },
      102: { field: 'avg_left_power_phase', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      103: { field: 'avg_left_power_phase_peak', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      104: { field: 'avg_right_power_phase', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      105: { field: 'avg_right_power_phase_peak', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      106: { field: 'avg_power_position', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      107: { field: 'max_power_position', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      108: { field: 'avg_cadence_position', type: 'uint8', scale: null, offset: 0, units: 'rpm' },
      109: { field: 'max_cadence_position', type: 'uint8', scale: null, offset: 0, units: 'rpm' },
      110: { field: 'enhanced_avg_speed', type: 'uint32', scale: 1000, offset: 0, units: 'm/s' },
      111: { field: 'enhanced_max_speed', type: 'uint32', scale: 1000, offset: 0, units: 'm/s' },
      112: { field: 'enhanced_avg_altitude', type: 'uint32', scale: 5, offset: -500, units: 'm' },
      113: { field: 'enhanced_min_altitude', type: 'uint32', scale: 5, offset: -500, units: 'm' },
      114: { field: 'enhanced_max_altitude', type: 'uint32', scale: 5, offset: -500, units: 'm' },
      115: { field: 'avg_lev_motor_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      116: { field: 'max_lev_motor_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      117: { field: 'lev_battery_consumption', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      118: { field: 'avg_vertical_ratio', type: 'uint16', scale: 100, offset: 0, units: 'percent' },
      119: { field: 'avg_stance_time_balance', type: 'uint16', scale: 100, offset: 0, units: 'percent' },
      120: { field: 'avg_step_length', type: 'uint16', scale: 10, offset: 0, units: 'mm' },
      121: { field: 'avg_vam', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' }
    },
    20: {
      name: 'record',
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: 's' },
      0: { field: 'position_lat', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      1: { field: 'position_long', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      2: { field: 'altitude', type: 'uint16', scale: 5, offset: -500, units: 'm' },
      3: { field: 'heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      4: { field: 'cadence', type: 'uint8', scale: null, offset: 0, units: 'rpm' },
      5: { field: 'distance', type: 'uint32', scale: 100, offset: 0, units: 'm' },
      6: { field: 'speed', type: 'uint16', scale: 1000, offset: 0, units: 'm/s' },
      7: { field: 'power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      8: { field: 'compressed_speed_distance', type: 'byte', scale: '100,16', offset: 0, units: 'm/s,m' },
      9: { field: 'grade', type: 'sint16', scale: 100, offset: 0, units: '%' },
      10: { field: 'resistance', type: 'uint8', scale: null, offset: 0, units: '' },
      11: { field: 'time_from_course', type: 'sint32', scale: 1000, offset: 0, units: 's' },
      12: { field: 'cycle_length', type: 'uint8', scale: 100, offset: 0, units: 'm' },
      13: { field: 'temperature', type: 'sint8', scale: null, offset: 0, units: 'C' },
      17: { field: 'speed_1s', type: 'uint8', scale: 16, offset: 0, units: 'm/s' },
      18: { field: 'cycles', type: 'uint8', scale: null, offset: 0, units: 'cycles' },
      19: { field: 'total_cycles', type: 'uint32', scale: null, offset: 0, units: 'cycles' },
      28: { field: 'compressed_accumulated_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      29: { field: 'accumulated_power', type: 'uint32', scale: null, offset: 0, units: 'watts' },
      30: { field: 'left_right_balance', type: 'left_right_balance', scale: null, offset: 0, units: '' },
      31: { field: 'gps_accuracy', type: 'uint8', scale: null, offset: 0, units: 'm' },
      32: { field: 'vertical_speed', type: 'sint16', scale: 1000, offset: 0, units: 'm/s' },
      33: { field: 'calories', type: 'uint16', scale: null, offset: 0, units: 'kcal' },
      39: { field: 'vertical_oscillation', type: 'uint16', scale: 10, offset: 0, units: 'mm' },
      40: { field: 'stance_time_percent', type: 'uint16', scale: 100, offset: 0, units: 'percent' },
      41: { field: 'stance_time', type: 'uint16', scale: 10, offset: 0, units: 'ms' },
      42: { field: 'activity_type', type: 'activity_type', scale: null, offset: 0, units: '' },
      43: { field: 'left_torque_effectiveness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      44: { field: 'right_torque_effectiveness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      45: { field: 'left_pedal_smoothness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      46: { field: 'right_pedal_smoothness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      47: { field: 'combined_pedal_smoothness', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      48: { field: 'time128', type: 'uint8', scale: 128, offset: 0, units: 's' },
      49: { field: 'stroke_type', type: 'stroke_type', scale: null, offset: 0, units: '' },
      50: { field: 'zone', type: 'uint8', scale: null, offset: 0, units: '' },
      51: { field: 'ball_speed', type: 'uint16', scale: 100, offset: 0, units: 'm/s' },
      52: { field: 'cadence256', type: 'uint16', scale: 256, offset: 0, units: 'rpm' },
      53: { field: 'fractional_cadence', type: 'uint8', scale: 128, offset: 0, units: 'rpm' },
      54: { field: 'total_hemoglobin_conc', type: 'uint16', scale: 100, offset: 0, units: 'g/dL' },
      55: { field: 'total_hemoglobin_conc_min', type: 'uint16', scale: 100, offset: 0, units: 'g/dL' },
      56: { field: 'total_hemoglobin_conc_max', type: 'uint16', scale: 100, offset: 0, units: 'g/dL' },
      57: { field: 'saturated_hemoglobin_percent', type: 'uint16', scale: 10, offset: 0, units: '%' },
      58: { field: 'saturated_hemoglobin_percent_min', type: 'uint16', scale: 10, offset: 0, units: '%' },
      59: { field: 'saturated_hemoglobin_percent_max', type: 'uint16', scale: 10, offset: 0, units: '%' },
      62: { field: 'device_index', type: 'device_index', scale: null, offset: 0, units: '' },
      67: { field: 'left_pco', type: 'sint8', scale: null, offset: 0, units: 'mm' },
      68: { field: 'right_pco', type: 'sint8', scale: null, offset: 0, units: 'mm' },
      69: { field: 'left_power_phase', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      70: { field: 'left_power_phase_peak', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      71: { field: 'right_power_phase', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      72: { field: 'right_power_phase_peak', type: 'uint8', scale: '0,7111111', offset: 0, units: 'degrees' },
      73: { field: 'enhanced_speed', type: 'uint32', scale: 1000, offset: 0, units: 'm/s' },
      78: { field: 'enhanced_altitude', type: 'uint32', scale: 5, offset: -500, units: 'm' },
      81: { field: 'battery_soc', type: 'uint8', scale: 2, offset: 0, units: 'percent' },
      82: { field: 'motor_power', type: 'uint16', scale: null, offset: 0, units: 'watts' },
      83: { field: 'vertical_ratio', type: 'uint16', scale: 100, offset: 0, units: 'percent' },
      84: { field: 'stance_time_balance', type: 'uint16', scale: 100, offset: 0, units: 'percent' },
      85: { field: 'step_length', type: 'uint16', scale: 10, offset: 0, units: 'mm' },
      91: { field: 'absolute_pressure', type: 'uint32', scale: null, offset: 0, units: 'Pa' },
      92: { field: 'depth', type: 'uint32', scale: null, offset: 0, units: 'm' },
      93: { field: 'next_stop_depth', type: 'uint32', scale: null, offset: 0, units: 'm' },
      94: { field: 'next_stop_time', type: 'uint32', scale: null, offset: 0, units: 's' },
      95: { field: 'time_to_surface', type: 'uint32', scale: null, offset: 0, units: 's' },
      96: { field: 'ndl_time', type: 'uint32', scale: null, offset: 0, units: 's' },
      97: { field: 'cns_load', type: 'uint8', scale: null, offset: 0, units: 'percent' },
      98: { field: 'n2_load', type: 'uint16', scale: null, offset: 0, units: 'percent' }
    },
    21: {
      name: 'event',
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: '', units: 's' },
      0: { field: 'event', type: 'event', scale: null, offset: '', units: '' },
      1: { field: 'event_type', type: 'event_type', scale: null, offset: '', units: '' },
      2: { field: 'data16', type: 'uint16', scale: null, offset: '', units: '' },
      3: { field: 'data', type: 'uint32', scale: null, offset: '', units: '' },
      4: { field: 'event_group', type: 'uint8', scale: null, offset: '', units: '' },
      7: { field: 'score', type: 'uint16', scale: null, offset: '', units: '' },
      8: { field: 'opponent_score', type: 'uint16', scale: null, offset: '', units: '' },
      9: { field: 'front_gear_num', type: 'uint8z', scale: null, offset: '', units: '' },
      10: { field: 'front_gear', type: 'uint8z', scale: null, offset: '', units: '' },
      11: { field: 'rear_gear_num', type: 'uint8z', scale: null, offset: '', units: '' },
      12: { field: 'rear_gear', type: 'uint8z', scale: null, offset: '', units: '' },
      13: { field: 'device_index', type: 'device_index', scale: null, offset: '', units: '' }
    },
    23: {
      name: 'device_info',
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: 's' },
      0: { field: 'device_index', type: 'uint8', scale: null, offset: 0, units: '' },
      1: { field: 'device_type', type: 'antplus_device_type', scale: null, offset: 0, units: '' },
      2: { field: 'manufacturer', type: 'manufacturer', scale: null, offset: 0, units: '' },
      3: { field: 'serial_number', type: 'uint32z', scale: null, offset: 0, units: '' },
      4: { field: 'product', type: 'uint16', scale: null, offset: 0, units: '' },
      5: { field: 'software_version', type: 'uint16', scale: 100, offset: 0, units: '' },
      6: { field: 'hardware_version', type: 'uint8', scale: null, offset: 0, units: '' },
      7: { field: 'cum_operating_time', type: 'uint32', scale: null, offset: 0, units: 's' },
      10: { field: 'battery_voltage', type: 'uint16', scale: 256, offset: 0, units: 'V' },
      11: { field: 'battery_status', type: 'battery_status', scale: null, offset: 0, units: '' },
      18: { field: 'sensor_position', type: 'body_location', scale: null, offset: 0, units: '' },
      19: { field: 'descriptor', type: 'string', scale: null, offset: 0, units: '' },
      20: { field: 'ant_transmission_type', type: 'uint8z', scale: null, offset: 0, units: '' },
      21: { field: 'ant_device_number', type: 'uint16z', scale: null, offset: 0, units: '' },
      22: { field: 'ant_network', type: 'ant_network', scale: null, offset: 0, units: '' },
      25: { field: 'source_type', type: 'source_type', scale: null, offset: 0, units: '' },
      27: { field: 'product_name', type: 'string', scale: null, offset: 0, units: '' }
    },
    26: {
      name: 'workout',
      4: { field: 'sport', type: 'sport', scale: null, offset: '', units: '' },
      5: { field: 'capabilities', type: 'workout_capabilities', scale: null, offset: '', units: '' },
      6: { field: 'num_valid_steps', type: 'uint16', scale: null, offset: '', units: '' },
      8: { field: 'wkt_name', type: 'string', scale: null, offset: '', units: '' }
    },
    27: {
      name: 'workout_step',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      0: { field: 'wkt_step_name', type: 'string', scale: null, offset: 0, units: '' },
      1: { field: 'duration_type', type: 'wkt_step_duration', scale: null, offset: 0, units: '' },
      2: { field: 'duration_value', type: 'uint32', scale: null, offset: 0, units: '' },
      3: { field: 'target_type', type: 'wkt_step_target', scale: null, offset: 0, units: '' },
      4: { field: 'target_value', type: 'uint32', scale: null, offset: 0, units: '' },
      5: { field: 'custom_target_value_low', type: 'uint32', scale: null, offset: 0, units: '' },
      6: { field: 'custom_target_value_high', type: 'uint32', scale: null, offset: 0, units: '' },
      7: { field: 'intensity', type: 'intensity', scale: null, offset: 0, units: '' }
    },
    30: {
      name: 'weight_scale',
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: 's' },
      0: { field: 'weight', type: 'weight', scale: 100, offset: 0, units: 'kg' },
      1: { field: 'percent_fat', type: 'uint16', scale: 100, offset: 0, units: '%' },
      2: { field: 'percent_hydration', type: 'uint16', scale: 100, offset: 0, units: '%' },
      3: { field: 'visceral_fat_mass', type: 'uint16', scale: 100, offset: 0, units: 'kg' },
      4: { field: 'bone_mass', type: 'uint16', scale: 100, offset: 0, units: 'kg' },
      5: { field: 'muscle_mass', type: 'uint16', scale: 100, offset: 0, units: 'kg' },
      7: { field: 'basal_met', type: 'uint16', scale: 4, offset: 0, units: 'kcal/day' },
      8: { field: 'physique_rating', type: 'uint8', scale: null, offset: 0, units: '' },
      9: { field: 'active_met', type: 'uint16', scale: 4, offset: 0, units: 'kcal/day' },
      10: { field: 'metabolic_age', type: 'uint8', scale: null, offset: 0, units: 'years' },
      11: { field: 'visceral_fat_rating', type: 'uint8', scale: null, offset: 0, units: '' },
      12: { field: 'user_profile_index', type: 'message_index', scale: null, offset: 0, units: '' }
    },
    31: {
      name: 'course',
      4: { field: 'sport', type: 'sport', scale: null, offset: '', units: '' },
      5: { field: 'name', type: 'string', scale: null, offset: '', units: '' },
      6: { field: 'capabilities', type: 'course_capabilities', scale: null, offset: '', units: '' }
    },
    32: {
      name: 'course_point',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      1: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: '' },
      2: { field: 'position_lat', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      3: { field: 'position_long', type: 'sint32', scale: null, offset: 0, units: 'semicircles' },
      4: { field: 'distance', type: 'uint32', scale: 100, offset: 0, units: 'm' },
      5: { field: 'type', type: 'course_point', scale: null, offset: 0, units: '' },
      6: { field: 'name', type: 'string', scale: null, offset: 0, units: '' },
      8: { field: 'favorite', type: 'bool', scale: null, offset: 0, units: '' }
    },
    33: {
      name: 'totals',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: 's' },
      0: { field: 'timer_time', type: 'uint32', scale: null, offset: 0, units: 's' },
      1: { field: 'distance', type: 'uint32', scale: null, offset: 0, units: 'm' },
      2: { field: 'calories', type: 'uint32', scale: null, offset: 0, units: 'kcal' },
      3: { field: 'sport', type: 'sport', scale: null, offset: 0, units: '' },
      4: { field: 'elapsed_time', type: 'uint32', scale: null, offset: 0, units: 's' },
      5: { field: 'sessions', type: 'uint16', scale: null, offset: 0, units: '' },
      6: { field: 'active_time', type: 'uint32', scale: null, offset: 0, units: 's' },
      9: { field: 'sport_index', type: 'uint8', scale: null, offset: 0, units: '' }
    },
    34: {
      name: 'activity',
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: '' },
      0: { field: 'total_timer_time', type: 'uint32', scale: 1000, offset: 0, units: 's' },
      1: { field: 'num_sessions', type: 'uint16', scale: null, offset: 0, units: '' },
      2: { field: 'type', type: 'activity', scale: null, offset: 0, units: '' },
      3: { field: 'event', type: 'event', scale: null, offset: 0, units: '' },
      4: { field: 'event_type', type: 'event_type', scale: null, offset: 0, units: '' },
      5: { field: 'local_timestamp', type: 'local_date_time', scale: null, offset: 0, units: '' },
      6: { field: 'event_group', type: 'uint8', scale: null, offset: 0, units: '' }
    },
    35: {
      name: 'software',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: '', units: '' },
      3: { field: 'version', type: 'uint16', scale: 100, offset: '', units: '' },
      5: { field: 'part_number', type: 'string', scale: null, offset: '', units: '' }
    },
    37: {
      name: 'file_capabilities',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: 0, units: '' },
      0: { field: 'type', type: 'file', scale: null, offset: 0, units: '' },
      1: { field: 'flags', type: 'file_flags', scale: null, offset: 0, units: '' },
      2: { field: 'directory', type: 'string', scale: null, offset: 0, units: '' },
      3: { field: 'max_count', type: 'uint16', scale: null, offset: 0, units: '' },
      4: { field: 'max_size', type: 'uint32', scale: null, offset: 0, units: 'bytes' }
    },
    38: {
      name: 'mesg_capabilities',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: '', units: '' },
      0: { field: 'file', type: 'file', scale: null, offset: '', units: '' },
      1: { field: 'mesg_num', type: 'mesg_num', scale: null, offset: '', units: '' },
      2: { field: 'count_type', type: 'mesg_count', scale: null, offset: '', units: '' },
      3: { field: 'count', type: 'uint16', scale: null, offset: '', units: '' }
    },
    39: {
      name: 'field_capabilities',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: '', units: '' },
      0: { field: 'file', type: 'file', scale: null, offset: '', units: '' },
      1: { field: 'mesg_num', type: 'mesg_num', scale: null, offset: '', units: '' },
      2: { field: 'field_num', type: 'uint8', scale: null, offset: '', units: '' },
      3: { field: 'count', type: 'uint16', scale: null, offset: '', units: '' }
    },
    49: {
      name: 'file_creator',
      0: { field: 'software_version', type: 'uint16', scale: null, offset: '', units: '' },
      1: { field: 'hardware_version', type: 'uint8', scale: null, offset: '', units: '' }
    },
    51: {
      name: 'blood_pressure',
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: 's' },
      0: { field: 'systolic_pressure', type: 'uint16', scale: null, offset: 0, units: 'mmHg' },
      1: { field: 'diastolic_pressure', type: 'uint16', scale: null, offset: 0, units: 'mmHg' },
      2: { field: 'mean_arterial_pressure', type: 'uint16', scale: null, offset: 0, units: 'mmHg' },
      3: { field: 'map_3_sample_mean', type: 'uint16', scale: null, offset: 0, units: 'mmHg' },
      4: { field: 'map_morning_values', type: 'uint16', scale: null, offset: 0, units: 'mmHg' },
      5: { field: 'map_evening_values', type: 'uint16', scale: null, offset: 0, units: 'mmHg' },
      6: { field: 'heart_rate', type: 'uint8', scale: null, offset: 0, units: 'bpm' },
      7: { field: 'heart_rate_type', type: 'hr_type', scale: null, offset: 0, units: '' },
      8: { field: 'status', type: 'bp_status', scale: null, offset: 0, units: '' },
      9: { field: 'user_profile_index', type: 'message_index', scale: null, offset: 0, units: '' }
    },
    78: {
      name: 'hrv',
      0: { field: 'time', type: 'uint16_array', scale: 1000, offset: 0, units: 's' }
    },
    206: {
      name: 'field_description',
      0: { field: 'developer_data_index', type: 'uint8', scale: null, offset: 0, units: '' },
      1: { field: 'field_definition_number', type: 'uint8', scale: null, offset: 0, units: '' },
      2: { field: 'fit_base_type_id', type: 'uint8', scale: null, offset: 0, units: '' },
      3: { field: 'field_name', type: 'string', scale: null, offset: 0, units: '' },
      //4: { field: 'array', type: 'uint8', scale: null, offset: 0, units: '' },
      //5: { field: 'components', type: 'string', scale: null, offset: 0, units: '' },
      6: { field: 'scale', type: 'uint8', scale: null, offset: 0, units: '' },
      7: { field: 'offset', type: 'sint8', scale: null, offset: 0, units: '' },
      8: { field: 'units', type: 'string', scale: null, offset: 0, units: '' },
      // 9: { field: 'bits', type: 'string', scale: null, offset: 0, units: '' },
      // 10: { field: 'accumulate', type: 'string', scale: null, offset: 0, units: '' },
      //13: { field: 'fit_base_unit_id', type: 'uint16', scale: null, offset: 0, units: '' },
      // 14: { field: 'native_mesg_num', type: 'mesg_num', scale: null, offset: 0, units: '' },
      15: { field: 'native_field_num', type: 'uint8', scale: null, offset: 0, units: '' }
    },
    207: {
      name: 'developer_data_id',
      0: { field: 'developer_id', type: 'uint8', scale: null, offset: 0, units: '' },
      1: { field: 'application_id', type: 'byte_array', scale: null, offset: 0, units: '' },
      2: { field: 'manufacturer_id', type: 'manufacturer', scale: null, offset: 0, units: '' },
      3: { field: 'developer_data_index', type: 'uint8', scale: null, offset: 0, units: '' },
      4: { field: 'application_version', type: 'uint8', scale: null, offset: 0, units: '' }
    },
    258: {
      name: 'dive_settings',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: '', units: '' },
      0: { field: 'name', type: 'string', scale: null, offset: 0, units: '' },
      1: { field: 'model', type: 'tissue_model_type', scale: null, offset: 0, units: '' },
      2: { field: 'gf_low', type: 'uint8', scale: null, offset: 0, units: 'percent' },
      3: { field: 'gf_high', type: 'uint8', scale: null, offset: 0, units: 'percent' },
      4: { field: 'water_type', type: 'water_type', scale: null, offset: 0, units: '' },
      5: { field: 'water_density', type: 'float32', scale: null, offset: 0, units: 'kg/m^3' },
      6: { field: 'po2_warn', type: 'uint8', scale: null, offset: 0, units: 'percent' },
      7: { field: 'po2_critical', type: 'uint8', scale: null, offset: 0, units: 'percent' },
      8: { field: 'po2_deco', type: 'uint8', scale: null, offset: 0, units: 'percent' },
      9: { field: 'safety_stop_enabled', type: 'bool', scale: null, offset: 0, units: '' },
      10: { field: 'bottom_depth', type: 'float32', scale: null, offset: 0, units: '' },
      11: { field: 'bottom_time', type: 'uint32', scale: null, offset: 0, units: '' },
      12: { field: 'apnea_countdown_enabled', type: 'bool', scale: null, offset: 0, units: '' },
      13: { field: 'apnea_countdown_time', type: 'uint32', scale: null, offset: 0, units: '' },
      14: { field: 'backlight_mode', type: 'dive_backlight_mode', scale: null, offset: 0, units: '' },
      15: { field: 'backlight_brightness', type: 'uint8', scale: null, offset: 0, units: '' },
      16: { field: 'backlight_timeout', type: 'backlight_timeout', scale: null, offset: 0, units: '' },
      17: { field: 'repeat_dive_time', type: 'uint16', scale: null, offset: 0, units: 's' },
      18: { field: 'safety_stop_time', type: 'uint16', scale: null, offset: 0, units: 's' },
      19: { field: 'heart_rate_source_type', type: 'source_type', scale: null, offset: 0, units: '' },
      20: { field: 'heart_rate_source', type: 'uint8', scale: null, offset: 0, units: '' }
    },
    259: {
      name: 'dive_gas',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: '', units: '' },
      0: { field: 'helium_content', type: 'uint8', scale: null, offset: '', units: 'percent' },
      1: { field: 'oxygen_content', type: 'uint8', scale: null, offset: '', units: 'percent' },
      2: { field: 'status', type: 'dive_gas_status', scale: null, offset: '', units: '' }
    },
    262: {
      name: 'dive_alarm',
      254: { field: 'message_index', type: 'message_index', scale: null, offset: '', units: '' },
      0: { field: 'depth', type: 'uint32', scale: null, offset: '', units: 'm' },
      1: { field: 'time', type: 'sint32', scale: null, offset: '', units: 's' },
      2: { field: 'enabled', type: 'bool', scale: null, offset: '', units: '' },
      3: { field: 'alarm_type', type: 'dive_alarm_type', scale: null, offset: '', units: '' },
      4: { field: 'sound', type: 'tone', scale: null, offset: '', units: '' },
      5: { field: 'dive_types', type: 'sub_sport', scale: null, offset: '', units: '' }
    },
    268: {
      name: 'dive_summary',
      253: { field: 'timestamp', type: 'date_time', scale: null, offset: 0, units: 's' },
      0: { field: 'reference_mesg', type: 'mesg_num', scale: null, offset: 0, units: '' },
      1: { field: 'reference_index', type: 'message_index', scale: null, offset: 0, units: '' },
      2: { field: 'avg_depth', type: 'uint32', scale: null, offset: 0, units: 'm' },
      3: { field: 'max_depth', type: 'uint32', scale: null, offset: 0, units: 'm' },
      4: { field: 'surface_interval', type: 'uint32', scale: null, offset: 0, units: 's' },
      5: { field: 'start_cns', type: 'uint8', scale: null, offset: 0, units: 'percent' },
      6: { field: 'end_cns', type: 'uint8', scale: null, offset: 0, units: 'percent' },
      7: { field: 'start_n2', type: 'uint16', scale: null, offset: 0, units: 'percent' },
      8: { field: 'end_n2', type: 'uint16', scale: null, offset: 0, units: 'percent' },
      9: { field: 'o2_toxicity', type: 'uint16', scale: null, offset: 0, units: 'OTUs' },
      10: { field: 'dive_number', type: 'uint32', scale: null, offset: 0, units: '' },
      11: { field: 'bottom_time', type: 'uint32', scale: null, offset: 0, units: 's' }
    }
  },
  types: {
    file: {
      1: 'device',
      2: 'settings',
      3: 'sport',
      4: 'activity',
      5: 'workout',
      6: 'course',
      7: 'schedules',
      9: 'weight',
      10: 'totals',
      11: 'goals',
      14: 'blood_pressure',
      15: 'monitoring_a',
      20: 'activity_summary',
      28: 'monitoring_daily',
      32: 'monitoring_b',
      34: 'segment',
      35: 'segment_list',
      40: 'exd_configuration',
      247: 'mfg_range_min',
      254: 'mfg_range_max'
    },
    mesg_num: {
      0: 'file_id',
      1: 'capabilities',
      2: 'device_settings',
      3: 'user_profile',
      4: 'hrm_profile',
      5: 'sdm_profile',
      6: 'bike_profile',
      7: 'zones_target',
      8: 'hr_zone',
      9: 'power_zone',
      10: 'met_zone',
      12: 'sport',
      15: 'goal',
      18: 'session',
      19: 'lap',
      20: 'record',
      21: 'event',
      23: 'device_info',
      26: 'workout',
      27: 'workout_step',
      28: 'schedule',
      30: 'weight_scale',
      31: 'course',
      32: 'course_point',
      33: 'totals',
      34: 'activity',
      35: 'software',
      37: 'file_capabilities',
      38: 'mesg_capabilities',
      39: 'field_capabilities',
      49: 'file_creator',
      51: 'blood_pressure',
      53: 'speed_zone',
      55: 'monitoring',
      72: 'training_file',
      78: 'hrv',
      80: 'ant_rx',
      81: 'ant_tx',
      82: 'ant_channel_id',
      101: 'length',
      103: 'monitoring_info',
      105: 'pad',
      106: 'slave_device',
      127: 'connectivity',
      128: 'weather_conditions',
      129: 'weather_alert',
      131: 'cadence_zone',
      132: 'hr',
      142: 'segment_lap',
      145: 'memo_glob',
      148: 'segment_id',
      149: 'segment_leaderboard_entry',
      150: 'segment_point',
      151: 'segment_file',
      158: 'workout_session',
      159: 'watchface_settings',
      160: 'gps_metadata',
      161: 'camera_event',
      162: 'timestamp_correlation',
      164: 'gyroscope_data',
      165: 'accelerometer_data',
      167: 'three_d_sensor_calibration',
      169: 'video_frame',
      174: 'obdii_data',
      177: 'nmea_sentence',
      178: 'aviation_attitude',
      184: 'video',
      185: 'video_title',
      186: 'video_description',
      187: 'video_clip',
      200: 'exd_screen_configuration',
      201: 'exd_data_field_configuration',
      202: 'exd_data_concept_configuration',
      206: 'field_description',
      207: 'developer_data_id',
      208: 'magnetometer_data',
      209: 'barometer_data',
      210: 'one_d_sensor_calibration',
      225: 'set',
      227: 'stress_level',
      258: 'dive_settings',
      259: 'dive_gas',
      262: 'dive_alarm',
      264: 'exercise_title',
      268: 'dive_summary',
      65280: 'mfg_range_min',
      65534: 'mfg_range_max'
    },
    checksum: {
      0: 'clear',
      1: 'ok'
    },
    file_flags: {
      0: 0,
      2: 'read',
      4: 'write',
      8: 'erase'
    },
    mesg_count: {
      0: 'num_per_file',
      1: 'max_per_file',
      2: 'max_per_file_type'
    },
    date_time: {
      0: 0,
      268435456: 'min'
    },
    local_date_time: {
      0: 0,
      268435456: 'min'
    },
    message_index: {
      0: 0,
      4095: 'mask',
      28672: 'reserved',
      32768: 'selected'
    },
    gender: {
      0: 'female',
      1: 'male'
    },
    language: {
      0: 'english',
      1: 'french',
      2: 'italian',
      3: 'german',
      4: 'spanish',
      5: 'croatian',
      6: 'czech',
      7: 'danish',
      8: 'dutch',
      9: 'finnish',
      10: 'greek',
      11: 'hungarian',
      12: 'norwegian',
      13: 'polish',
      14: 'portuguese',
      15: 'slovakian',
      16: 'slovenian',
      17: 'swedish',
      18: 'russian',
      19: 'turkish',
      20: 'latvian',
      21: 'ukrainian',
      22: 'arabic',
      23: 'farsi',
      24: 'bulgarian',
      25: 'romanian',
      26: 'chinese',
      27: 'japanese',
      28: 'korean',
      29: 'taiwanese',
      30: 'thai',
      31: 'hebrew',
      32: 'brazilian_portuguese',
      33: 'indonesian',
      34: 'malaysian',
      35: 'vietnamese',
      36: 'burmese',
      37: 'mongolian',
      254: 'custom'
    },
    language_bits_0: {
      0: 0,
      1: 'english',
      2: 'french',
      4: 'italian',
      8: 'german',
      16: 'spanish',
      32: 'croatian',
      64: 'czech',
      128: 'danish'
    },
    language_bits_1: {
      0: 0,
      1: 'dutch',
      2: 'finnish',
      4: 'greek',
      8: 'hungarian',
      16: 'norwegian',
      32: 'polish',
      64: 'portuguese',
      128: 'slovakian'
    },
    language_bits_2: {
      0: 0,
      1: 'slovenian',
      2: 'swedish',
      4: 'russian',
      8: 'turkish',
      16: 'latvian',
      32: 'ukrainian',
      64: 'arabic',
      128: 'farsi'
    },
    language_bits_3: {
      0: 0,
      1: 'bulgarian',
      2: 'romanian',
      4: 'chinese',
      8: 'japanese',
      16: 'korean',
      32: 'taiwanese',
      64: 'thai',
      128: 'hebrew'
    },
    language_bits_4: {
      0: 0,
      1: 'brazilian_portuguese',
      2: 'indonesian',
      4: 'malaysian',
      8: 'vietnamese',
      16: 'burmese',
      32: 'mongolian'
    },
    time_zone: {
      0: 'almaty',
      1: 'bangkok',
      2: 'bombay',
      3: 'brasilia',
      4: 'cairo',
      5: 'cape_verde_is',
      6: 'darwin',
      7: 'eniwetok',
      8: 'fiji',
      9: 'hong_kong',
      10: 'islamabad',
      11: 'kabul',
      12: 'magadan',
      13: 'mid_atlantic',
      14: 'moscow',
      15: 'muscat',
      16: 'newfoundland',
      17: 'samoa',
      18: 'sydney',
      19: 'tehran',
      20: 'tokyo',
      21: 'us_alaska',
      22: 'us_atlantic',
      23: 'us_central',
      24: 'us_eastern',
      25: 'us_hawaii',
      26: 'us_mountain',
      27: 'us_pacific',
      28: 'other',
      29: 'auckland',
      30: 'kathmandu',
      31: 'europe_western_wet',
      32: 'europe_central_cet',
      33: 'europe_eastern_eet',
      34: 'jakarta',
      35: 'perth',
      36: 'adelaide',
      37: 'brisbane',
      38: 'tasmania',
      39: 'iceland',
      40: 'amsterdam',
      41: 'athens',
      42: 'barcelona',
      43: 'berlin',
      44: 'brussels',
      45: 'budapest',
      46: 'copenhagen',
      47: 'dublin',
      48: 'helsinki',
      49: 'lisbon',
      50: 'london',
      51: 'madrid',
      52: 'munich',
      53: 'oslo',
      54: 'paris',
      55: 'prague',
      56: 'reykjavik',
      57: 'rome',
      58: 'stockholm',
      59: 'vienna',
      60: 'warsaw',
      61: 'zurich',
      62: 'quebec',
      63: 'ontario',
      64: 'manitoba',
      65: 'saskatchewan',
      66: 'alberta',
      67: 'british_columbia',
      68: 'boise',
      69: 'boston',
      70: 'chicago',
      71: 'dallas',
      72: 'denver',
      73: 'kansas_city',
      74: 'las_vegas',
      75: 'los_angeles',
      76: 'miami',
      77: 'minneapolis',
      78: 'new_york',
      79: 'new_orleans',
      80: 'phoenix',
      81: 'santa_fe',
      82: 'seattle',
      83: 'washington_dc',
      84: 'us_arizona',
      85: 'chita',
      86: 'ekaterinburg',
      87: 'irkutsk',
      88: 'kaliningrad',
      89: 'krasnoyarsk',
      90: 'novosibirsk',
      91: 'petropavlovsk_kamchatskiy',
      92: 'samara',
      93: 'vladivostok',
      94: 'mexico_central',
      95: 'mexico_mountain',
      96: 'mexico_pacific',
      97: 'cape_town',
      98: 'winkhoek',
      99: 'lagos',
      100: 'riyahd',
      101: 'venezuela',
      102: 'australia_lh',
      103: 'santiago',
      253: 'manual',
      254: 'automatic'
    },
    display_measure: {
      0: 'metric',
      1: 'statute',
      2: 'nautical'
    },
    display_heart: {
      0: 'bpm',
      1: 'max',
      2: 'reserve'
    },
    display_power: {
      0: 'watts',
      1: 'percent_ftp'
    },
    display_position: {
      0: 'degree',
      1: 'degree_minute',
      2: 'degree_minute_second',
      3: 'austrian_grid',
      4: 'british_grid',
      5: 'dutch_grid',
      6: 'hungarian_grid',
      7: 'finnish_grid',
      8: 'german_grid',
      9: 'icelandic_grid',
      10: 'indonesian_equatorial',
      11: 'indonesian_irian',
      12: 'indonesian_southern',
      13: 'india_zone_0',
      14: 'india_zone_IA',
      15: 'india_zone_IB',
      16: 'india_zone_IIA',
      17: 'india_zone_IIB',
      18: 'india_zone_IIIA',
      19: 'india_zone_IIIB',
      20: 'india_zone_IVA',
      21: 'india_zone_IVB',
      22: 'irish_transverse',
      23: 'irish_grid',
      24: 'loran',
      25: 'maidenhead_grid',
      26: 'mgrs_grid',
      27: 'new_zealand_grid',
      28: 'new_zealand_transverse',
      29: 'qatar_grid',
      30: 'modified_swedish_grid',
      31: 'swedish_grid',
      32: 'south_african_grid',
      33: 'swiss_grid',
      34: 'taiwan_grid',
      35: 'united_states_grid',
      36: 'utm_ups_grid',
      37: 'west_malayan',
      38: 'borneo_rso',
      39: 'estonian_grid',
      40: 'latvian_grid',
      41: 'swedish_ref_99_grid'
    },
    switch: {
      0: 'off',
      1: 'on',
      2: 'auto'
    },
    sport: {
      0: 'generic',
      1: 'running',
      2: 'cycling',
      3: 'transition',
      4: 'fitness_equipment',
      5: 'swimming',
      6: 'basketball',
      7: 'soccer',
      8: 'tennis',
      9: 'american_football',
      10: 'training',
      11: 'walking',
      12: 'cross_country_skiing',
      13: 'alpine_skiing',
      14: 'snowboarding',
      15: 'rowing',
      16: 'mountaineering',
      17: 'hiking',
      18: 'multisport',
      19: 'paddling',
      20: 'flying',
      21: 'e_biking',
      22: 'motorcycling',
      23: 'boating',
      24: 'driving',
      25: 'golf',
      26: 'hang_gliding',
      27: 'horseback_riding',
      28: 'hunting',
      29: 'fishing',
      30: 'inline_skating',
      31: 'rock_climbing',
      32: 'sailing',
      33: 'ice_skating',
      34: 'sky_diving',
      35: 'snowshoeing',
      36: 'snowmobiling',
      37: 'stand_up_paddleboarding',
      38: 'surfing',
      39: 'wakeboarding',
      40: 'water_skiing',
      41: 'kayaking',
      42: 'rafting',
      43: 'windsurfing',
      44: 'kitesurfing',
      45: 'tactical',
      46: 'jumpmaster',
      47: 'boxing',
      48: 'floor_climbing',
      53: 'diving',
      254: 'all'
    },
    sport_bits_0: {
      0: 0,
      1: 'generic',
      2: 'running',
      4: 'cycling',
      8: 'transition',
      16: 'fitness_equipment',
      32: 'swimming',
      64: 'basketball',
      128: 'soccer'
    },
    sport_bits_1: {
      0: 0,
      1: 'tennis',
      2: 'american_football',
      4: 'training',
      8: 'walking',
      16: 'cross_country_skiing',
      32: 'alpine_skiing',
      64: 'snowboarding',
      128: 'rowing'
    },
    sport_bits_2: {
      0: 0,
      1: 'mountaineering',
      2: 'hiking',
      4: 'multisport',
      8: 'paddling',
      16: 'flying',
      32: 'e_biking',
      64: 'motorcycling',
      128: 'boating'
    },
    sport_bits_3: {
      0: 0,
      1: 'driving',
      2: 'golf',
      4: 'hang_gliding',
      8: 'horseback_riding',
      16: 'hunting',
      32: 'fishing',
      64: 'inline_skating',
      128: 'rock_climbing'
    },
    sport_bits_4: {
      0: 0,
      1: 'sailing',
      2: 'ice_skating',
      4: 'sky_diving',
      8: 'snowshoeing',
      16: 'snowmobiling',
      32: 'stand_up_paddleboarding',
      64: 'surfing',
      128: 'wakeboarding'
    },
    sport_bits_5: {
      0: 0,
      1: 'water_skiing',
      2: 'kayaking',
      4: 'rafting',
      8: 'windsurfing',
      16: 'kitesurfing',
      32: 'tactical',
      64: 'jumpmaster',
      128: 'boxing'
    },
    sport_bits_6: {
      0: 0,
      1: 'floor_climbing'
    },
    sub_sport: {
      0: 'generic',
      1: 'treadmill',
      2: 'street',
      3: 'trail',
      4: 'track',
      5: 'spin',
      6: 'indoor_cycling',
      7: 'road',
      8: 'mountain',
      9: 'downhill',
      10: 'recumbent',
      11: 'cyclocross',
      12: 'hand_cycling',
      13: 'track_cycling',
      14: 'indoor_rowing',
      15: 'elliptical',
      16: 'stair_climbing',
      17: 'lap_swimming',
      18: 'open_water',
      19: 'flexibility_training',
      20: 'strength_training',
      21: 'warm_up',
      22: 'match',
      23: 'exercise',
      24: 'challenge',
      25: 'indoor_skiing',
      26: 'cardio_training',
      27: 'indoor_walking',
      28: 'e_bike_fitness',
      29: 'bmx',
      30: 'casual_walking',
      31: 'speed_walking',
      32: 'bike_to_run_transition',
      33: 'run_to_bike_transition',
      34: 'swim_to_bike_transition',
      35: 'atv',
      36: 'motocross',
      37: 'backcountry',
      38: 'resort',
      39: 'rc_drone',
      40: 'wingsuit',
      41: 'whitewater',
      42: 'skate_skiing',
      43: 'yoga',
      44: 'pilates',
      45: 'indoor_running',
      46: 'gravel_cycling',
      47: 'e_bike_mountain',
      48: 'commuting',
      49: 'mixed_surface',
      50: 'navigate',
      51: 'track_me',
      52: 'map',
      53: 'single_gas_diving',
      54: 'multi_gas_diving',
      55: 'gauge_diving',
      56: 'apnea_diving',
      57: 'apnea_hunting',
      58: 'virtual_activity',
      59: 'obstacle',
      254: 'all'
    },
    sport_event: {
      0: 'uncategorized',
      1: 'geocaching',
      2: 'fitness',
      3: 'recreation',
      4: 'race',
      5: 'special_event',
      6: 'training',
      7: 'transportation',
      8: 'touring'
    },
    activity: {
      0: 'manual',
      1: 'auto_multi_sport'
    },
    intensity: {
      0: 'active',
      1: 'rest',
      2: 'warmup',
      3: 'cooldown'
    },
    session_trigger: {
      0: 'activity_end',
      1: 'manual',
      2: 'auto_multi_sport',
      3: 'fitness_equipment'
    },
    autolap_trigger: {
      0: 'time',
      1: 'distance',
      2: 'position_start',
      3: 'position_lap',
      4: 'position_waypoint',
      5: 'position_marked',
      6: 'off'
    },
    lap_trigger: {
      0: 'manual',
      1: 'time',
      2: 'distance',
      3: 'position_start',
      4: 'position_lap',
      5: 'position_waypoint',
      6: 'position_marked',
      7: 'session_end',
      8: 'fitness_equipment'
    },
    time_mode: {
      0: 'hour12',
      1: 'hour24',
      2: 'military',
      3: 'hour_12_with_seconds',
      4: 'hour_24_with_seconds',
      5: 'utc'
    },
    backlight_mode: {
      0: 'off',
      1: 'manual',
      2: 'key_and_messages',
      3: 'auto_brightness',
      4: 'smart_notifications',
      5: 'key_and_messages_night',
      6: 'key_and_messages_and_smart_notifications'
    },
    date_mode: {
      0: 'day_month',
      1: 'month_day'
    },
    backlight_timeout: {
      0: 'infinite'
    },
    event: {
      0: 'timer',
      3: 'workout',
      4: 'workout_step',
      5: 'power_down',
      6: 'power_up',
      7: 'off_course',
      8: 'session',
      9: 'lap',
      10: 'course_point',
      11: 'battery',
      12: 'virtual_partner_pace',
      13: 'hr_high_alert',
      14: 'hr_low_alert',
      15: 'speed_high_alert',
      16: 'speed_low_alert',
      17: 'cad_high_alert',
      18: 'cad_low_alert',
      19: 'power_high_alert',
      20: 'power_low_alert',
      21: 'recovery_hr',
      22: 'battery_low',
      23: 'time_duration_alert',
      24: 'distance_duration_alert',
      25: 'calorie_duration_alert',
      26: 'activity',
      27: 'fitness_equipment',
      28: 'length',
      32: 'user_marker',
      33: 'sport_point',
      36: 'calibration',
      42: 'front_gear_change',
      43: 'rear_gear_change',
      44: 'rider_position_change',
      45: 'elev_high_alert',
      46: 'elev_low_alert',
      47: 'comm_timeout'
    },
    event_type: {
      0: 'start',
      1: 'stop',
      2: 'consecutive_depreciated',
      3: 'marker',
      4: 'stop_all',
      5: 'begin_depreciated',
      6: 'end_depreciated',
      7: 'end_all_depreciated',
      8: 'stop_disable',
      9: 'stop_disable_all'
    },
    timer_trigger: {
      0: 'manual',
      1: 'auto',
      2: 'fitness_equipment'
    },
    fitness_equipment_state: {
      0: 'ready',
      1: 'in_use',
      2: 'paused',
      3: 'unknown'
    },
    tone: {
      0: 'off',
      1: 'tone',
      2: 'vibrate',
      3: 'tone_and_vibrate'
    },
    autoscroll: {
      0: 'none',
      1: 'slow',
      2: 'medium',
      3: 'fast'
    },
    activity_class: {
      0: 0,
      100: 'level_max',
      127: 'level',
      128: 'athlete'
    },
    hr_zone_calc: {
      0: 'custom',
      1: 'percent_max_hr',
      2: 'percent_hrr'
    },
    pwr_zone_calc: {
      0: 'custom',
      1: 'percent_ftp'
    },
    wkt_step_duration: {
      0: 'time',
      1: 'distance',
      2: 'hr_less_than',
      3: 'hr_greater_than',
      4: 'calories',
      5: 'open',
      6: 'repeat_until_steps_cmplt',
      7: 'repeat_until_time',
      8: 'repeat_until_distance',
      9: 'repeat_until_calories',
      10: 'repeat_until_hr_less_than',
      11: 'repeat_until_hr_greater_than',
      12: 'repeat_until_power_less_than',
      13: 'repeat_until_power_greater_than',
      14: 'power_less_than',
      15: 'power_greater_than',
      16: 'training_peaks_tss',
      17: 'repeat_until_power_last_lap_less_than',
      18: 'repeat_until_max_power_last_lap_less_than',
      19: 'power_3s_less_than',
      20: 'power_10s_less_than',
      21: 'power_30s_less_than',
      22: 'power_3s_greater_than',
      23: 'power_10s_greater_than',
      24: 'power_30s_greater_than',
      25: 'power_lap_less_than',
      26: 'power_lap_greater_than',
      27: 'repeat_until_training_peaks_tss',
      28: 'repetition_time',
      29: 'reps'
    },
    wkt_step_target: {
      0: 'speed',
      1: 'heart_rate',
      2: 'open',
      3: 'cadence',
      4: 'power',
      5: 'grade',
      6: 'resistance',
      7: 'power_3s',
      8: 'power_10s',
      9: 'power_30s',
      10: 'power_lap',
      11: 'swim_stroke',
      12: 'speed_lap',
      13: 'heart_rate_lap'
    },
    goal: {
      0: 'time',
      1: 'distance',
      2: 'calories',
      3: 'frequency',
      4: 'steps',
      5: 'ascent',
      6: 'active_minutes'
    },
    goal_recurrence: {
      0: 'off',
      1: 'daily',
      2: 'weekly',
      3: 'monthly',
      4: 'yearly',
      5: 'custom'
    },
    goal_source: {
      0: 'auto',
      1: 'community',
      2: 'user'
    },
    schedule: {
      0: 'workout',
      1: 'course'
    },
    course_point: {
      0: 'generic',
      1: 'summit',
      2: 'valley',
      3: 'water',
      4: 'food',
      5: 'danger',
      6: 'left',
      7: 'right',
      8: 'straight',
      9: 'first_aid',
      10: 'fourth_category',
      11: 'third_category',
      12: 'second_category',
      13: 'first_category',
      14: 'hors_category',
      15: 'sprint',
      16: 'left_fork',
      17: 'right_fork',
      18: 'middle_fork',
      19: 'slight_left',
      20: 'sharp_left',
      21: 'slight_right',
      22: 'sharp_right',
      23: 'u_turn',
      24: 'segment_start',
      25: 'segment_end'
    },
    manufacturer: {
      0: 0,
      1: 'garmin',
      2: 'garmin_fr405_antfs',
      3: 'zephyr',
      4: 'dayton',
      5: 'idt',
      6: 'srm',
      7: 'quarq',
      8: 'ibike',
      9: 'saris',
      10: 'spark_hk',
      11: 'tanita',
      12: 'echowell',
      13: 'dynastream_oem',
      14: 'nautilus',
      15: 'dynastream',
      16: 'timex',
      17: 'metrigear',
      18: 'xelic',
      19: 'beurer',
      20: 'cardiosport',
      21: 'a_and_d',
      22: 'hmm',
      23: 'suunto',
      24: 'thita_elektronik',
      25: 'gpulse',
      26: 'clean_mobile',
      27: 'pedal_brain',
      28: 'peaksware',
      29: 'saxonar',
      30: 'lemond_fitness',
      31: 'dexcom',
      32: 'wahoo_fitness',
      33: 'octane_fitness',
      34: 'archinoetics',
      35: 'the_hurt_box',
      36: 'citizen_systems',
      37: 'magellan',
      38: 'osynce',
      39: 'holux',
      40: 'concept2',
      42: 'one_giant_leap',
      43: 'ace_sensor',
      44: 'brim_brothers',
      45: 'xplova',
      46: 'perception_digital',
      47: 'bf1systems',
      48: 'pioneer',
      49: 'spantec',
      50: 'metalogics',
      51: '4iiiis',
      52: 'seiko_epson',
      53: 'seiko_epson_oem',
      54: 'ifor_powell',
      55: 'maxwell_guider',
      56: 'star_trac',
      57: 'breakaway',
      58: 'alatech_technology_ltd',
      59: 'mio_technology_europe',
      60: 'rotor',
      61: 'geonaute',
      62: 'id_bike',
      63: 'specialized',
      64: 'wtek',
      65: 'physical_enterprises',
      66: 'north_pole_engineering',
      67: 'bkool',
      68: 'cateye',
      69: 'stages_cycling',
      70: 'sigmasport',
      71: 'tomtom',
      72: 'peripedal',
      73: 'wattbike',
      76: 'moxy',
      77: 'ciclosport',
      78: 'powerbahn',
      79: 'acorn_projects_aps',
      80: 'lifebeam',
      81: 'bontrager',
      82: 'wellgo',
      83: 'scosche',
      84: 'magura',
      85: 'woodway',
      86: 'elite',
      87: 'nielsen_kellerman',
      88: 'dk_city',
      89: 'tacx',
      90: 'direction_technology',
      91: 'magtonic',
      92: '1partcarbon',
      93: 'inside_ride_technologies',
      94: 'sound_of_motion',
      95: 'stryd',
      96: 'icg',
      97: 'mipulse',
      98: 'bsx_athletics',
      99: 'look',
      100: 'campagnolo_srl',
      101: 'body_bike_smart',
      102: 'praxisworks',
      103: 'limits_technology',
      104: 'topaction_technology',
      105: 'cosinuss',
      106: 'fitcare',
      107: 'magene',
      108: 'giant_manufacturing_co',
      109: 'tigrasport',
      110: 'salutron',
      111: 'technogym',
      112: 'bryton_sensors',
      113: 'latitude_limited',
      114: 'soaring_technology',
      115: 'igpsport',
      116: 'thinkrider',
      117: 'gopher_sport',
      118: 'waterrower',
      119: 'orangetheory',
      120: 'inpeak',
      121: 'kinetic',
      122: 'johnson_health_tech',
      123: 'polar_electro',
      124: 'seesense',
      125: 'nci_technology',
      255: 'development',
      257: 'healthandlife',
      258: 'lezyne',
      259: 'scribe_labs',
      260: 'zwift',
      261: 'watteam',
      262: 'recon',
      263: 'favero_electronics',
      264: 'dynovelo',
      265: 'strava',
      266: 'precor',
      267: 'bryton',
      268: 'sram',
      269: 'navman',
      270: 'cobi',
      271: 'spivi',
      272: 'mio_magellan',
      273: 'evesports',
      274: 'sensitivus_gauge',
      275: 'podoon',
      276: 'life_time_fitness',
      277: 'falco_e_motors',
      278: 'minoura',
      279: 'cycliq',
      280: 'luxottica',
      281: 'trainer_road',
      282: 'the_sufferfest',
      283: 'fullspeedahead',
      284: 'virtualtraining',
      285: 'feedbacksports',
      286: 'omata',
      287: 'vdo',
      288: 'magneticdays',
      289: 'hammerhead',
      290: 'kinetic_by_kurt',
      291: 'shapelog',
      292: 'dabuziduo',
      293: 'jetblack',
      294: 'coros',
      295: 'virtugo',
      296: 'velosense',
      5759: 'actigraphcorp'
    },
    garmin_product: {
      0: 'hrm_bike',
      1: 'hrm1',
      2: 'axh01',
      3: 'axb01',
      4: 'axb02',
      5: 'hrm2ss',
      6: 'dsi_alf02',
      7: 'hrm3ss',
      8: 'hrm_run_single_byte_product_id',
      9: 'bsm',
      10: 'bcm',
      11: 'axs01',
      12: 'hrm_tri_single_byte_product_id',
      14: 'fr225_single_byte_product_id',
      473: 'fr301_china',
      474: 'fr301_japan',
      475: 'fr301_korea',
      494: 'fr301_taiwan',
      717: 'fr405',
      782: 'fr50',
      987: 'fr405_japan',
      988: 'fr60',
      1011: 'dsi_alf01',
      1018: 'fr310xt',
      1036: 'edge500',
      1124: 'fr110',
      1169: 'edge800',
      1199: 'edge500_taiwan',
      1213: 'edge500_japan',
      1253: 'chirp',
      1274: 'fr110_japan',
      1325: 'edge200',
      1328: 'fr910xt',
      1333: 'edge800_taiwan',
      1334: 'edge800_japan',
      1341: 'alf04',
      1345: 'fr610',
      1360: 'fr210_japan',
      1380: 'vector_ss',
      1381: 'vector_cp',
      1386: 'edge800_china',
      1387: 'edge500_china',
      1410: 'fr610_japan',
      1422: 'edge500_korea',
      1436: 'fr70',
      1446: 'fr310xt_4t',
      1461: 'amx',
      1482: 'fr10',
      1497: 'edge800_korea',
      1499: 'swim',
      1537: 'fr910xt_china',
      1551: 'fenix',
      1555: 'edge200_taiwan',
      1561: 'edge510',
      1567: 'edge810',
      1570: 'tempe',
      1600: 'fr910xt_japan',
      1623: 'fr620',
      1632: 'fr220',
      1664: 'fr910xt_korea',
      1688: 'fr10_japan',
      1721: 'edge810_japan',
      1735: 'virb_elite',
      1736: 'edge_touring',
      1742: 'edge510_japan',
      1743: 'hrm_tri',
      1752: 'hrm_run',
      1765: 'fr920xt',
      1821: 'edge510_asia',
      1822: 'edge810_china',
      1823: 'edge810_taiwan',
      1836: 'edge1000',
      1837: 'vivo_fit',
      1853: 'virb_remote',
      1885: 'vivo_ki',
      1903: 'fr15',
      1907: 'vivo_active',
      1918: 'edge510_korea',
      1928: 'fr620_japan',
      1929: 'fr620_china',
      1930: 'fr220_japan',
      1931: 'fr220_china',
      1936: 'approach_s6',
      1956: 'vivo_smart',
      1967: 'fenix2',
      1988: 'epix',
      2050: 'fenix3',
      2052: 'edge1000_taiwan',
      2053: 'edge1000_japan',
      2061: 'fr15_japan',
      2067: 'edge520',
      2070: 'edge1000_china',
      2072: 'fr620_russia',
      2073: 'fr220_russia',
      2079: 'vector_s',
      2100: 'edge1000_korea',
      2130: 'fr920xt_taiwan',
      2131: 'fr920xt_china',
      2132: 'fr920xt_japan',
      2134: 'virbx',
      2135: 'vivo_smart_apac',
      2140: 'etrex_touch',
      2147: 'edge25',
      2148: 'fr25',
      2150: 'vivo_fit2',
      2153: 'fr225',
      2156: 'fr630',
      2157: 'fr230',
      2158: 'fr735xt',
      2160: 'vivo_active_apac',
      2161: 'vector_2',
      2162: 'vector_2s',
      2172: 'virbxe',
      2173: 'fr620_taiwan',
      2174: 'fr220_taiwan',
      2175: 'truswing',
      2188: 'fenix3_china',
      2189: 'fenix3_twn',
      2192: 'varia_headlight',
      2193: 'varia_taillight_old',
      2204: 'edge_explore_1000',
      2219: 'fr225_asia',
      2225: 'varia_radar_taillight',
      2226: 'varia_radar_display',
      2238: 'edge20',
      2262: 'd2_bravo',
      2266: 'approach_s20',
      2276: 'varia_remote',
      2327: 'hrm4_run',
      2337: 'vivo_active_hr',
      2348: 'vivo_smart_hr',
      2368: 'vivo_move',
      2398: 'varia_vision',
      2406: 'vivo_fit3',
      2413: 'fenix3_hr',
      2417: 'virb_ultra_30',
      2429: 'index_smart_scale',
      2431: 'fr235',
      2432: 'fenix3_chronos',
      2441: 'oregon7xx',
      2444: 'rino7xx',
      2496: 'nautix',
      2530: 'edge_820',
      2531: 'edge_explore_820',
      2544: 'fenix5s',
      2547: 'd2_bravo_titanium',
      2567: 'varia_ut800',
      2593: 'running_dynamics_pod',
      2604: 'fenix5x',
      2606: 'vivo_fit_jr',
      2691: 'fr935',
      2697: 'fenix5',
      2859: 'descent',
      10007: 'sdm4',
      10014: 'edge_remote',
      20119: 'training_center',
      65531: 'connectiq_simulator',
      65532: 'android_antplus_plugin',
      65534: 'connect'
    },
    antplus_device_type: {
      0: 0,
      1: 'antfs',
      11: 'bike_power',
      12: 'environment_sensor_legacy',
      15: 'multi_sport_speed_distance',
      16: 'control',
      17: 'fitness_equipment',
      18: 'blood_pressure',
      19: 'geocache_node',
      20: 'light_electric_vehicle',
      25: 'env_sensor',
      26: 'racquet',
      27: 'control_hub',
      31: 'muscle_oxygen',
      35: 'bike_light_main',
      36: 'bike_light_shared',
      38: 'exd',
      40: 'bike_radar',
      119: 'weight_scale',
      120: 'heart_rate',
      121: 'bike_speed_cadence',
      122: 'bike_cadence',
      123: 'bike_speed',
      124: 'stride_speed_distance'
    },
    ant_network: {
      0: 'public',
      1: 'antplus',
      2: 'antfs',
      3: 'private'
    },
    workout_capabilities: {
      0: 0,
      1: 'interval',
      2: 'custom',
      4: 'fitness_equipment',
      8: 'firstbeat',
      16: 'new_leaf',
      32: 'tcx',
      128: 'speed',
      256: 'heart_rate',
      512: 'distance',
      1024: 'cadence',
      2048: 'power',
      4096: 'grade',
      8192: 'resistance',
      16384: 'protected'
    },
    battery_status: {
      0: 0,
      1: 'new',
      2: 'good',
      3: 'ok',
      4: 'low',
      5: 'critical',
      6: 'charging',
      7: 'unknown'
    },
    hr_type: {
      0: 'normal',
      1: 'irregular'
    },
    course_capabilities: {
      0: 0,
      1: 'processed',
      2: 'valid',
      4: 'time',
      8: 'distance',
      16: 'position',
      32: 'heart_rate',
      64: 'power',
      128: 'cadence',
      256: 'training',
      512: 'navigation',
      1024: 'bikeway'
    },
    weight: {
      0: 0,
      65534: 'calculating'
    },
    workout_hr: {
      0: 0,
      100: 'bpm_offset'
    },
    workout_power: {
      0: 0,
      1000: 'watts_offset'
    },
    bp_status: {
      0: 'no_error',
      1: 'error_incomplete_data',
      2: 'error_no_measurement',
      3: 'error_data_out_of_range',
      4: 'error_irregular_heart_rate'
    },
    user_local_id: {
      0: 'local_min',
      15: 'local_max',
      16: 'stationary_min',
      255: 'stationary_max',
      256: 'portable_min',
      65534: 'portable_max'
    },
    swim_stroke: {
      0: 'freestyle',
      1: 'backstroke',
      2: 'breaststroke',
      3: 'butterfly',
      4: 'drill',
      5: 'mixed',
      6: 'im'
    },
    activity_type: {
      0: 'generic',
      1: 'running',
      2: 'cycling',
      3: 'transition',
      4: 'fitness_equipment',
      5: 'swimming',
      6: 'walking',
      8: 'sedentary',
      254: 'all'
    },
    activity_subtype: {
      0: 'generic',
      1: 'treadmill',
      2: 'street',
      3: 'trail',
      4: 'track',
      5: 'spin',
      6: 'indoor_cycling',
      7: 'road',
      8: 'mountain',
      9: 'downhill',
      10: 'recumbent',
      11: 'cyclocross',
      12: 'hand_cycling',
      13: 'track_cycling',
      14: 'indoor_rowing',
      15: 'elliptical',
      16: 'stair_climbing',
      17: 'lap_swimming',
      18: 'open_water',
      254: 'all'
    },
    activity_level: {
      0: 'low',
      1: 'medium',
      2: 'high'
    },
    side: {
      0: 'right',
      1: 'left'
    },
    left_right_balance: {
      0: 0,
      127: 'mask',
      128: 'right'
    },
    left_right_balance_100: {
      0: 0,
      16383: 'mask',
      32768: 'right'
    },
    length_type: {
      0: 'idle',
      1: 'active'
    },
    day_of_week: {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    },
    connectivity_capabilities: {
      0: 0,
      1: 'bluetooth',
      2: 'bluetooth_le',
      4: 'ant',
      8: 'activity_upload',
      16: 'course_download',
      32: 'workout_download',
      64: 'live_track',
      128: 'weather_conditions',
      256: 'weather_alerts',
      512: 'gps_ephemeris_download',
      1024: 'explicit_archive',
      2048: 'setup_incomplete',
      4096: 'continue_sync_after_software_update',
      8192: 'connect_iq_app_download',
      16384: 'golf_course_download',
      32768: 'device_initiates_sync',
      65536: 'connect_iq_watch_app_download',
      131072: 'connect_iq_widget_download',
      262144: 'connect_iq_watch_face_download',
      524288: 'connect_iq_data_field_download',
      1048576: 'connect_iq_app_managment',
      2097152: 'swing_sensor',
      4194304: 'swing_sensor_remote',
      8388608: 'incident_detection',
      16777216: 'audio_prompts',
      33554432: 'wifi_verification',
      67108864: 'true_up',
      134217728: 'find_my_watch',
      268435456: 'remote_manual_sync',
      536870912: 'live_track_auto_start',
      1073741824: 'live_track_messaging',
      2147483648: 'instant_input'
    },
    weather_report: {
      0: 'current',
      1: 'hourly_forecast',
      2: 'daily_forecast'
    },
    weather_status: {
      0: 'clear',
      1: 'partly_cloudy',
      2: 'mostly_cloudy',
      3: 'rain',
      4: 'snow',
      5: 'windy',
      6: 'thunderstorms',
      7: 'wintry_mix',
      8: 'fog',
      11: 'hazy',
      12: 'hail',
      13: 'scattered_showers',
      14: 'scattered_thunderstorms',
      15: 'unknown_precipitation',
      16: 'light_rain',
      17: 'heavy_rain',
      18: 'light_snow',
      19: 'heavy_snow',
      20: 'light_rain_snow',
      21: 'heavy_rain_snow',
      22: 'cloudy'
    },
    weather_severity: {
      0: 'unknown',
      1: 'warning',
      2: 'watch',
      3: 'advisory',
      4: 'statement'
    },
    weather_severe_type: {
      0: 'unspecified',
      1: 'tornado',
      2: 'tsunami',
      3: 'hurricane',
      4: 'extreme_wind',
      5: 'typhoon',
      6: 'inland_hurricane',
      7: 'hurricane_force_wind',
      8: 'waterspout',
      9: 'severe_thunderstorm',
      10: 'wreckhouse_winds',
      11: 'les_suetes_wind',
      12: 'avalanche',
      13: 'flash_flood',
      14: 'tropical_storm',
      15: 'inland_tropical_storm',
      16: 'blizzard',
      17: 'ice_storm',
      18: 'freezing_rain',
      19: 'debris_flow',
      20: 'flash_freeze',
      21: 'dust_storm',
      22: 'high_wind',
      23: 'winter_storm',
      24: 'heavy_freezing_spray',
      25: 'extreme_cold',
      26: 'wind_chill',
      27: 'cold_wave',
      28: 'heavy_snow_alert',
      29: 'lake_effect_blowing_snow',
      30: 'snow_squall',
      31: 'lake_effect_snow',
      32: 'winter_weather',
      33: 'sleet',
      34: 'snowfall',
      35: 'snow_and_blowing_snow',
      36: 'blowing_snow',
      37: 'snow_alert',
      38: 'arctic_outflow',
      39: 'freezing_drizzle',
      40: 'storm',
      41: 'storm_surge',
      42: 'rainfall',
      43: 'areal_flood',
      44: 'coastal_flood',
      45: 'lakeshore_flood',
      46: 'excessive_heat',
      47: 'heat',
      48: 'weather',
      49: 'high_heat_and_humidity',
      50: 'humidex_and_health',
      51: 'humidex',
      52: 'gale',
      53: 'freezing_spray',
      54: 'special_marine',
      55: 'squall',
      56: 'strong_wind',
      57: 'lake_wind',
      58: 'marine_weather',
      59: 'wind',
      60: 'small_craft_hazardous_seas',
      61: 'hazardous_seas',
      62: 'small_craft',
      63: 'small_craft_winds',
      64: 'small_craft_rough_bar',
      65: 'high_water_level',
      66: 'ashfall',
      67: 'freezing_fog',
      68: 'dense_fog',
      69: 'dense_smoke',
      70: 'blowing_dust',
      71: 'hard_freeze',
      72: 'freeze',
      73: 'frost',
      74: 'fire_weather',
      75: 'flood',
      76: 'rip_tide',
      77: 'high_surf',
      78: 'smog',
      79: 'air_quality',
      80: 'brisk_wind',
      81: 'air_stagnation',
      82: 'low_water',
      83: 'hydrological',
      84: 'special_weather'
    },
    stroke_type: {
      0: 'no_event',
      1: 'other',
      2: 'serve',
      3: 'forehand',
      4: 'backhand',
      5: 'smash'
    },
    body_location: {
      0: 'left_leg',
      1: 'left_calf',
      2: 'left_shin',
      3: 'left_hamstring',
      4: 'left_quad',
      5: 'left_glute',
      6: 'right_leg',
      7: 'right_calf',
      8: 'right_shin',
      9: 'right_hamstring',
      10: 'right_quad',
      11: 'right_glute',
      12: 'torso_back',
      13: 'left_lower_back',
      14: 'left_upper_back',
      15: 'right_lower_back',
      16: 'right_upper_back',
      17: 'torso_front',
      18: 'left_abdomen',
      19: 'left_chest',
      20: 'right_abdomen',
      21: 'right_chest',
      22: 'left_arm',
      23: 'left_shoulder',
      24: 'left_bicep',
      25: 'left_tricep',
      26: 'left_brachioradialis',
      27: 'left_forearm_extensors',
      28: 'right_arm',
      29: 'right_shoulder',
      30: 'right_bicep',
      31: 'right_tricep',
      32: 'right_brachioradialis',
      33: 'right_forearm_extensors',
      34: 'neck',
      35: 'throat',
      36: 'waist_mid_back',
      37: 'waist_front',
      38: 'waist_left',
      39: 'waist_right'
    },
    segment_lap_status: {
      0: 'end',
      1: 'fail'
    },
    segment_leaderboard_type: {
      0: 'overall',
      1: 'personal_best',
      2: 'connections',
      3: 'group',
      4: 'challenger',
      5: 'kom',
      6: 'qom',
      7: 'pr',
      8: 'goal',
      9: 'rival',
      10: 'club_leader'
    },
    segment_delete_status: {
      0: 'do_not_delete',
      1: 'delete_one',
      2: 'delete_all'
    },
    segment_selection_type: {
      0: 'starred',
      1: 'suggested'
    },
    source_type: {
      0: 'ant',
      1: 'antplus',
      2: 'bluetooth',
      3: 'bluetooth_low_energy',
      4: 'wifi',
      5: 'local'
    },
    display_orientation: {
      0: 'auto',
      1: 'portrait',
      2: 'landscape',
      3: 'portrait_flipped',
      4: 'landscape_flipped'
    },
    workout_equipment: {
      0: 'none',
      1: 'swim_fins',
      2: 'swim_kickboard',
      3: 'swim_paddles',
      4: 'swim_pull_buoy',
      5: 'swim_snorkel'
    },
    watchface_mode: {
      0: 'digital',
      1: 'analog',
      2: 'connect_iq',
      3: 'disabled'
    },
    digital_watchface_layout: {
      0: 'traditional',
      1: 'modern',
      2: 'bold'
    },
    analog_watchface_layout: {
      0: 'minimal',
      1: 'traditional',
      2: 'modern'
    },
    rider_position_type: {
      0: 'seated',
      1: 'standing',
      2: 'transition_to_seated',
      3: 'transition_to_standing'
    },
    power_phase_type: {
      0: 'power_phase_start_angle',
      1: 'power_phase_end_angle',
      2: 'power_phase_arc_length',
      3: 'power_phase_center'
    },
    camera_event_type: {
      0: 'video_start',
      1: 'video_split',
      2: 'video_end',
      3: 'photo_taken',
      4: 'video_second_stream_start',
      5: 'video_second_stream_split',
      6: 'video_second_stream_end',
      7: 'video_split_start',
      8: 'video_second_stream_split_start',
      11: 'video_pause',
      12: 'video_second_stream_pause',
      13: 'video_resume',
      14: 'video_second_stream_resume'
    },
    sensor_type: {
      0: 'accelerometer',
      1: 'gyroscope',
      2: 'compass',
      3: 'barometer'
    },
    bike_light_network_config_type: {
      0: 'auto',
      4: 'individual',
      5: 'high_visibility',
      6: 'trail'
    },
    comm_timeout_type: {
      0: 'wildcard_pairing_timeout',
      1: 'pairing_timeout',
      2: 'connection_lost',
      3: 'connection_timeout'
    },
    camera_orientation_type: {
      0: 'camera_orientation_0',
      1: 'camera_orientation_90',
      2: 'camera_orientation_180',
      3: 'camera_orientation_270'
    },
    attitude_stage: {
      0: 'failed',
      1: 'aligning',
      2: 'degraded',
      3: 'valid'
    },
    attitude_validity: {
      0: 0,
      1: 'track_angle_heading_valid',
      2: 'pitch_valid',
      4: 'roll_valid',
      8: 'lateral_body_accel_valid',
      16: 'normal_body_accel_valid',
      32: 'turn_rate_valid',
      64: 'hw_fail',
      128: 'mag_invalid',
      256: 'no_gps',
      512: 'gps_invalid',
      1024: 'solution_coasting',
      2048: 'true_track_angle',
      4096: 'magnetic_heading'
    },
    auto_sync_frequency: {
      0: 'never',
      1: 'occasionally',
      2: 'frequent',
      3: 'once_a_day',
      4: 'remote'
    },
    exd_layout: {
      0: 'full_screen',
      1: 'half_vertical',
      2: 'half_horizontal',
      3: 'half_vertical_right_split',
      4: 'half_horizontal_bottom_split',
      5: 'full_quarter_split',
      6: 'half_vertical_left_split',
      7: 'half_horizontal_top_split'
    },
    exd_display_type: {
      0: 'numerical',
      1: 'simple',
      2: 'graph',
      3: 'bar',
      4: 'circle_graph',
      5: 'virtual_partner',
      6: 'balance',
      7: 'string_list',
      8: 'string',
      9: 'simple_dynamic_icon',
      10: 'gauge'
    },
    exd_data_units: {
      0: 'no_units',
      1: 'laps',
      2: 'miles_per_hour',
      3: 'kilometers_per_hour',
      4: 'feet_per_hour',
      5: 'meters_per_hour',
      6: 'degrees_celsius',
      7: 'degrees_farenheit',
      8: 'zone',
      9: 'gear',
      10: 'rpm',
      11: 'bpm',
      12: 'degrees',
      13: 'millimeters',
      14: 'meters',
      15: 'kilometers',
      16: 'feet',
      17: 'yards',
      18: 'kilofeet',
      19: 'miles',
      20: 'time',
      21: 'enum_turn_type',
      22: 'percent',
      23: 'watts',
      24: 'watts_per_kilogram',
      25: 'enum_battery_status',
      26: 'enum_bike_light_beam_angle_mode',
      27: 'enum_bike_light_battery_status',
      28: 'enum_bike_light_network_config_type',
      29: 'lights',
      30: 'seconds',
      31: 'minutes',
      32: 'hours',
      33: 'calories',
      34: 'kilojoules',
      35: 'milliseconds',
      36: 'second_per_mile',
      37: 'second_per_kilometer',
      38: 'centimeter',
      39: 'enum_course_point',
      40: 'bradians',
      41: 'enum_sport',
      42: 'inches_hg',
      43: 'mm_hg',
      44: 'mbars',
      45: 'hecto_pascals',
      46: 'feet_per_min',
      47: 'meters_per_min',
      48: 'meters_per_sec',
      49: 'eight_cardinal'
    },
    exd_qualifiers: {
      0: 'no_qualifier',
      1: 'instantaneous',
      2: 'average',
      3: 'lap',
      4: 'maximum',
      5: 'maximum_average',
      6: 'maximum_lap',
      7: 'last_lap',
      8: 'average_lap',
      9: 'to_destination',
      10: 'to_go',
      11: 'to_next',
      12: 'next_course_point',
      13: 'total',
      14: 'three_second_average',
      15: 'ten_second_average',
      16: 'thirty_second_average',
      17: 'percent_maximum',
      18: 'percent_maximum_average',
      19: 'lap_percent_maximum',
      20: 'elapsed',
      21: 'sunrise',
      22: 'sunset',
      23: 'compared_to_virtual_partner',
      24: 'maximum_24h',
      25: 'minimum_24h',
      26: 'minimum',
      27: 'first',
      28: 'second',
      29: 'third',
      30: 'shifter',
      31: 'last_sport',
      32: 'moving',
      33: 'stopped',
      34: 'estimated_total',
      242: 'zone_9',
      243: 'zone_8',
      244: 'zone_7',
      245: 'zone_6',
      246: 'zone_5',
      247: 'zone_4',
      248: 'zone_3',
      249: 'zone_2',
      250: 'zone_1'
    },
    exd_descriptors: {
      0: 'bike_light_battery_status',
      1: 'beam_angle_status',
      2: 'batery_level',
      3: 'light_network_mode',
      4: 'number_lights_connected',
      5: 'cadence',
      6: 'distance',
      7: 'estimated_time_of_arrival',
      8: 'heading',
      9: 'time',
      10: 'battery_level',
      11: 'trainer_resistance',
      12: 'trainer_target_power',
      13: 'time_seated',
      14: 'time_standing',
      15: 'elevation',
      16: 'grade',
      17: 'ascent',
      18: 'descent',
      19: 'vertical_speed',
      20: 'di2_battery_level',
      21: 'front_gear',
      22: 'rear_gear',
      23: 'gear_ratio',
      24: 'heart_rate',
      25: 'heart_rate_zone',
      26: 'time_in_heart_rate_zone',
      27: 'heart_rate_reserve',
      28: 'calories',
      29: 'gps_accuracy',
      30: 'gps_signal_strength',
      31: 'temperature',
      32: 'time_of_day',
      33: 'balance',
      34: 'pedal_smoothness',
      35: 'power',
      36: 'functional_threshold_power',
      37: 'intensity_factor',
      38: 'work',
      39: 'power_ratio',
      40: 'normalized_power',
      41: 'training_stress_Score',
      42: 'time_on_zone',
      43: 'speed',
      44: 'laps',
      45: 'reps',
      46: 'workout_step',
      47: 'course_distance',
      48: 'navigation_distance',
      49: 'course_estimated_time_of_arrival',
      50: 'navigation_estimated_time_of_arrival',
      51: 'course_time',
      52: 'navigation_time',
      53: 'course_heading',
      54: 'navigation_heading',
      55: 'power_zone',
      56: 'torque_effectiveness',
      57: 'timer_time',
      58: 'power_weight_ratio',
      59: 'left_platform_center_offset',
      60: 'right_platform_center_offset',
      61: 'left_power_phase_start_angle',
      62: 'right_power_phase_start_angle',
      63: 'left_power_phase_finish_angle',
      64: 'right_power_phase_finish_angle',
      65: 'gears',
      66: 'pace',
      67: 'training_effect',
      68: 'vertical_oscillation',
      69: 'vertical_ratio',
      70: 'ground_contact_time',
      71: 'left_ground_contact_time_balance',
      72: 'right_ground_contact_time_balance',
      73: 'stride_length',
      74: 'running_cadence',
      75: 'performance_condition',
      76: 'course_type',
      77: 'time_in_power_zone',
      78: 'navigation_turn',
      79: 'course_location',
      80: 'navigation_location',
      81: 'compass',
      82: 'gear_combo',
      83: 'muscle_oxygen',
      84: 'icon',
      85: 'compass_heading',
      86: 'gps_heading',
      87: 'gps_elevation',
      88: 'anaerobic_training_effect',
      89: 'course',
      90: 'off_course',
      91: 'glide_ratio',
      92: 'vertical_distance',
      93: 'vmg',
      94: 'ambient_pressure',
      95: 'pressure',
      96: 'vam'
    },
    auto_activity_detect: {
      0: 'none',
      1: 'running',
      2: 'cycling',
      4: 'swimming',
      8: 'walking',
      16: 'elliptical',
      32: 'sedentary'
    },
    supported_exd_screen_layouts: {
      0: 0,
      1: 'full_screen',
      2: 'half_vertical',
      4: 'half_horizontal',
      8: 'half_vertical_right_split',
      16: 'half_horizontal_bottom_split',
      32: 'full_quarter_split',
      64: 'half_vertical_left_split',
      128: 'half_horizontal_top_split'
    },
    fit_base_type: {
      0: 'enum',
      1: 'sint8',
      2: 'uint8',
      7: 'string',
      10: 'uint8z',
      13: 'byte',
      131: 'sint16',
      132: 'uint16',
      133: 'sint32',
      134: 'uint32',
      136: 'float32',
      137: 'float64',
      139: 'uint16z',
      140: 'uint32z',
      142: 'sint64',
      143: 'uint64',
      144: 'uint64z'
    },
    turn_type: {
      0: 'arriving_idx',
      1: 'arriving_left_idx',
      2: 'arriving_right_idx',
      3: 'arriving_via_idx',
      4: 'arriving_via_left_idx',
      5: 'arriving_via_right_idx',
      6: 'bear_keep_left_idx',
      7: 'bear_keep_right_idx',
      8: 'continue_idx',
      9: 'exit_left_idx',
      10: 'exit_right_idx',
      11: 'ferry_idx',
      12: 'roundabout_45_idx',
      13: 'roundabout_90_idx',
      14: 'roundabout_135_idx',
      15: 'roundabout_180_idx',
      16: 'roundabout_225_idx',
      17: 'roundabout_270_idx',
      18: 'roundabout_315_idx',
      19: 'roundabout_360_idx',
      20: 'roundabout_neg_45_idx',
      21: 'roundabout_neg_90_idx',
      22: 'roundabout_neg_135_idx',
      23: 'roundabout_neg_180_idx',
      24: 'roundabout_neg_225_idx',
      25: 'roundabout_neg_270_idx',
      26: 'roundabout_neg_315_idx',
      27: 'roundabout_neg_360_idx',
      28: 'roundabout_generic_idx',
      29: 'roundabout_neg_generic_idx',
      30: 'sharp_turn_left_idx',
      31: 'sharp_turn_right_idx',
      32: 'turn_left_idx',
      33: 'turn_right_idx',
      34: 'uturn_left_idx',
      35: 'uturn_right_idx',
      36: 'icon_inv_idx',
      37: 'icon_idx_cnt'
    },
    bike_light_beam_angle_mode: {
      0: 'manual',
      1: 'auto'
    },
    fit_base_unit: {
      0: 'other',
      1: 'kilogram',
      2: 'pound'
    },
    set_type: {
      0: 'rest',
      1: 'active'
    },
    exercise_category: {
      0: 'bench_press',
      1: 'calf_raise',
      2: 'cardio',
      3: 'carry',
      4: 'chop',
      5: 'core',
      6: 'crunch',
      7: 'curl',
      8: 'deadlift',
      9: 'flye',
      10: 'hip_raise',
      11: 'hip_stability',
      12: 'hip_swing',
      13: 'hyperextension',
      14: 'lateral_raise',
      15: 'leg_curl',
      16: 'leg_raise',
      17: 'lunge',
      18: 'olympic_lift',
      19: 'plank',
      20: 'plyo',
      21: 'pull_up',
      22: 'push_up',
      23: 'row',
      24: 'shoulder_press',
      25: 'shoulder_stability',
      26: 'shrug',
      27: 'sit_up',
      28: 'squat',
      29: 'total_body',
      30: 'triceps_extension',
      31: 'warm_up',
      32: 'run',
      65534: 'unknown'
    },
    bench_press_exercise_name: {
      0: 'alternating_dumbbell_chest_press_on_swiss_ball',
      1: 'barbell_bench_press',
      2: 'barbell_board_bench_press',
      3: 'barbell_floor_press',
      4: 'close_grip_barbell_bench_press',
      5: 'decline_dumbbell_bench_press',
      6: 'dumbbell_bench_press',
      7: 'dumbbell_floor_press',
      8: 'incline_barbell_bench_press',
      9: 'incline_dumbbell_bench_press',
      10: 'incline_smith_machine_bench_press',
      11: 'isometric_barbell_bench_press',
      12: 'kettlebell_chest_press',
      13: 'neutral_grip_dumbbell_bench_press',
      14: 'neutral_grip_dumbbell_incline_bench_press',
      15: 'one_arm_floor_press',
      16: 'weighted_one_arm_floor_press',
      17: 'partial_lockout',
      18: 'reverse_grip_barbell_bench_press',
      19: 'reverse_grip_incline_bench_press',
      20: 'single_arm_cable_chest_press',
      21: 'single_arm_dumbbell_bench_press',
      22: 'smith_machine_bench_press',
      23: 'swiss_ball_dumbbell_chest_press',
      24: 'triple_stop_barbell_bench_press',
      25: 'wide_grip_barbell_bench_press',
      26: 'alternating_dumbbell_chest_press'
    },
    calf_raise_exercise_name: {
      0: '3_way_calf_raise',
      1: '3_way_weighted_calf_raise',
      2: '3_way_single_leg_calf_raise',
      3: '3_way_weighted_single_leg_calf_raise',
      4: 'donkey_calf_raise',
      5: 'weighted_donkey_calf_raise',
      6: 'seated_calf_raise',
      7: 'weighted_seated_calf_raise',
      8: 'seated_dumbbell_toe_raise',
      9: 'single_leg_bent_knee_calf_raise',
      10: 'weighted_single_leg_bent_knee_calf_raise',
      11: 'single_leg_decline_push_up',
      12: 'single_leg_donkey_calf_raise',
      13: 'weighted_single_leg_donkey_calf_raise',
      14: 'single_leg_hip_raise_with_knee_hold',
      15: 'single_leg_standing_calf_raise',
      16: 'single_leg_standing_dumbbell_calf_raise',
      17: 'standing_barbell_calf_raise',
      18: 'standing_calf_raise',
      19: 'weighted_standing_calf_raise',
      20: 'standing_dumbbell_calf_raise'
    },
    cardio_exercise_name: {
      0: 'bob_and_weave_circle',
      1: 'weighted_bob_and_weave_circle',
      2: 'cardio_core_crawl',
      3: 'weighted_cardio_core_crawl',
      4: 'double_under',
      5: 'weighted_double_under',
      6: 'jump_rope',
      7: 'weighted_jump_rope',
      8: 'jump_rope_crossover',
      9: 'weighted_jump_rope_crossover',
      10: 'jump_rope_jog',
      11: 'weighted_jump_rope_jog',
      12: 'jumping_jacks',
      13: 'weighted_jumping_jacks',
      14: 'ski_moguls',
      15: 'weighted_ski_moguls',
      16: 'split_jacks',
      17: 'weighted_split_jacks',
      18: 'squat_jacks',
      19: 'weighted_squat_jacks',
      20: 'triple_under',
      21: 'weighted_triple_under'
    },
    carry_exercise_name: {
      0: 'bar_holds',
      1: 'farmers_walk',
      2: 'farmers_walk_on_toes',
      3: 'hex_dumbbell_hold',
      4: 'overhead_carry'
    },
    chop_exercise_name: {
      0: 'cable_pull_through',
      1: 'cable_rotational_lift',
      2: 'cable_woodchop',
      3: 'cross_chop_to_knee',
      4: 'weighted_cross_chop_to_knee',
      5: 'dumbbell_chop',
      6: 'half_kneeling_rotation',
      7: 'weighted_half_kneeling_rotation',
      8: 'half_kneeling_rotational_chop',
      9: 'half_kneeling_rotational_reverse_chop',
      10: 'half_kneeling_stability_chop',
      11: 'half_kneeling_stability_reverse_chop',
      12: 'kneeling_rotational_chop',
      13: 'kneeling_rotational_reverse_chop',
      14: 'kneeling_stability_chop',
      15: 'kneeling_woodchopper',
      16: 'medicine_ball_wood_chops',
      17: 'power_squat_chops',
      18: 'weighted_power_squat_chops',
      19: 'standing_rotational_chop',
      20: 'standing_split_rotational_chop',
      21: 'standing_split_rotational_reverse_chop',
      22: 'standing_stability_reverse_chop'
    },
    core_exercise_name: {
      0: 'abs_jabs',
      1: 'weighted_abs_jabs',
      2: 'alternating_plate_reach',
      3: 'barbell_rollout',
      4: 'weighted_barbell_rollout',
      5: 'body_bar_oblique_twist',
      6: 'cable_core_press',
      7: 'cable_side_bend',
      8: 'side_bend',
      9: 'weighted_side_bend',
      10: 'crescent_circle',
      11: 'weighted_crescent_circle',
      12: 'cycling_russian_twist',
      13: 'weighted_cycling_russian_twist',
      14: 'elevated_feet_russian_twist',
      15: 'weighted_elevated_feet_russian_twist',
      16: 'half_turkish_get_up',
      17: 'kettlebell_windmill',
      18: 'kneeling_ab_wheel',
      19: 'weighted_kneeling_ab_wheel',
      20: 'modified_front_lever',
      21: 'open_knee_tucks',
      22: 'weighted_open_knee_tucks',
      23: 'side_abs_leg_lift',
      24: 'weighted_side_abs_leg_lift',
      25: 'swiss_ball_jackknife',
      26: 'weighted_swiss_ball_jackknife',
      27: 'swiss_ball_pike',
      28: 'weighted_swiss_ball_pike',
      29: 'swiss_ball_rollout',
      30: 'weighted_swiss_ball_rollout',
      31: 'triangle_hip_press',
      32: 'weighted_triangle_hip_press',
      33: 'trx_suspended_jackknife',
      34: 'weighted_trx_suspended_jackknife',
      35: 'u_boat',
      36: 'weighted_u_boat',
      37: 'windmill_switches',
      38: 'weighted_windmill_switches',
      39: 'alternating_slide_out',
      40: 'weighted_alternating_slide_out',
      41: 'ghd_back_extensions',
      42: 'weighted_ghd_back_extensions',
      43: 'overhead_walk',
      44: 'inchworm',
      45: 'weighted_modified_front_lever',
      46: 'russian_twist',
      47: 'abdominal_leg_rotations',
      48: 'arm_and_leg_extension_on_knees',
      49: 'bicycle',
      50: 'bicep_curl_with_leg_extension',
      51: 'cat_cow',
      52: 'corkscrew',
      53: 'criss_cross',
      54: 'criss_cross_with_ball',
      55: 'double_leg_stretch',
      56: 'knee_folds',
      57: 'lower_lift',
      58: 'neck_pull',
      59: 'pelvic_clocks',
      60: 'roll_over',
      61: 'roll_up',
      62: 'rolling',
      63: 'rowing_1',
      64: 'rowing_2',
      65: 'scissors',
      66: 'single_leg_circles',
      67: 'single_leg_stretch',
      68: 'snake_twist_1_and_2',
      69: 'swan',
      70: 'swimming',
      71: 'teaser',
      72: 'the_hundred'
    },
    crunch_exercise_name: {
      0: 'bicycle_crunch',
      1: 'cable_crunch',
      2: 'circular_arm_crunch',
      3: 'crossed_arms_crunch',
      4: 'weighted_crossed_arms_crunch',
      5: 'cross_leg_reverse_crunch',
      6: 'weighted_cross_leg_reverse_crunch',
      7: 'crunch_chop',
      8: 'weighted_crunch_chop',
      9: 'double_crunch',
      10: 'weighted_double_crunch',
      11: 'elbow_to_knee_crunch',
      12: 'weighted_elbow_to_knee_crunch',
      13: 'flutter_kicks',
      14: 'weighted_flutter_kicks',
      15: 'foam_roller_reverse_crunch_on_bench',
      16: 'weighted_foam_roller_reverse_crunch_on_bench',
      17: 'foam_roller_reverse_crunch_with_dumbbell',
      18: 'foam_roller_reverse_crunch_with_medicine_ball',
      19: 'frog_press',
      20: 'hanging_knee_raise_oblique_crunch',
      21: 'weighted_hanging_knee_raise_oblique_crunch',
      22: 'hip_crossover',
      23: 'weighted_hip_crossover',
      24: 'hollow_rock',
      25: 'weighted_hollow_rock',
      26: 'incline_reverse_crunch',
      27: 'weighted_incline_reverse_crunch',
      28: 'kneeling_cable_crunch',
      29: 'kneeling_cross_crunch',
      30: 'weighted_kneeling_cross_crunch',
      31: 'kneeling_oblique_cable_crunch',
      32: 'knees_to_elbow',
      33: 'leg_extensions',
      34: 'weighted_leg_extensions',
      35: 'leg_levers',
      36: 'mcgill_curl_up',
      37: 'weighted_mcgill_curl_up',
      38: 'modified_pilates_roll_up_with_ball',
      39: 'weighted_modified_pilates_roll_up_with_ball',
      40: 'pilates_crunch',
      41: 'weighted_pilates_crunch',
      42: 'pilates_roll_up_with_ball',
      43: 'weighted_pilates_roll_up_with_ball',
      44: 'raised_legs_crunch',
      45: 'weighted_raised_legs_crunch',
      46: 'reverse_crunch',
      47: 'weighted_reverse_crunch',
      48: 'reverse_crunch_on_a_bench',
      49: 'weighted_reverse_crunch_on_a_bench',
      50: 'reverse_curl_and_lift',
      51: 'weighted_reverse_curl_and_lift',
      52: 'rotational_lift',
      53: 'weighted_rotational_lift',
      54: 'seated_alternating_reverse_crunch',
      55: 'weighted_seated_alternating_reverse_crunch',
      56: 'seated_leg_u',
      57: 'weighted_seated_leg_u',
      58: 'side_to_side_crunch_and_weave',
      59: 'weighted_side_to_side_crunch_and_weave',
      60: 'single_leg_reverse_crunch',
      61: 'weighted_single_leg_reverse_crunch',
      62: 'skater_crunch_cross',
      63: 'weighted_skater_crunch_cross',
      64: 'standing_cable_crunch',
      65: 'standing_side_crunch',
      66: 'step_climb',
      67: 'weighted_step_climb',
      68: 'swiss_ball_crunch',
      69: 'swiss_ball_reverse_crunch',
      70: 'weighted_swiss_ball_reverse_crunch',
      71: 'swiss_ball_russian_twist',
      72: 'weighted_swiss_ball_russian_twist',
      73: 'swiss_ball_side_crunch',
      74: 'weighted_swiss_ball_side_crunch',
      75: 'thoracic_crunches_on_foam_roller',
      76: 'weighted_thoracic_crunches_on_foam_roller',
      77: 'triceps_crunch',
      78: 'weighted_bicycle_crunch',
      79: 'weighted_crunch',
      80: 'weighted_swiss_ball_crunch',
      81: 'toes_to_bar',
      82: 'weighted_toes_to_bar',
      83: 'crunch',
      84: 'straight_leg_crunch_with_ball'
    },
    curl_exercise_name: {
      0: 'alternating_dumbbell_biceps_curl',
      1: 'alternating_dumbbell_biceps_curl_on_swiss_ball',
      2: 'alternating_incline_dumbbell_biceps_curl',
      3: 'barbell_biceps_curl',
      4: 'barbell_reverse_wrist_curl',
      5: 'barbell_wrist_curl',
      6: 'behind_the_back_barbell_reverse_wrist_curl',
      7: 'behind_the_back_one_arm_cable_curl',
      8: 'cable_biceps_curl',
      9: 'cable_hammer_curl',
      10: 'cheating_barbell_biceps_curl',
      11: 'close_grip_ez_bar_biceps_curl',
      12: 'cross_body_dumbbell_hammer_curl',
      13: 'dead_hang_biceps_curl',
      14: 'decline_hammer_curl',
      15: 'dumbbell_biceps_curl_with_static_hold',
      16: 'dumbbell_hammer_curl',
      17: 'dumbbell_reverse_wrist_curl',
      18: 'dumbbell_wrist_curl',
      19: 'ez_bar_preacher_curl',
      20: 'forward_bend_biceps_curl',
      21: 'hammer_curl_to_press',
      22: 'incline_dumbbell_biceps_curl',
      23: 'incline_offset_thumb_dumbbell_curl',
      24: 'kettlebell_biceps_curl',
      25: 'lying_concentration_cable_curl',
      26: 'one_arm_preacher_curl',
      27: 'plate_pinch_curl',
      28: 'preacher_curl_with_cable',
      29: 'reverse_ez_bar_curl',
      30: 'reverse_grip_wrist_curl',
      31: 'reverse_grip_barbell_biceps_curl',
      32: 'seated_alternating_dumbbell_biceps_curl',
      33: 'seated_dumbbell_biceps_curl',
      34: 'seated_reverse_dumbbell_curl',
      35: 'split_stance_offset_pinky_dumbbell_curl',
      36: 'standing_alternating_dumbbell_curls',
      37: 'standing_dumbbell_biceps_curl',
      38: 'standing_ez_bar_biceps_curl',
      39: 'static_curl',
      40: 'swiss_ball_dumbbell_overhead_triceps_extension',
      41: 'swiss_ball_ez_bar_preacher_curl',
      42: 'twisting_standing_dumbbell_biceps_curl',
      43: 'wide_grip_ez_bar_biceps_curl'
    },

    deadlift_exercise_name: {
      0: 'barbell_deadlift',
      1: 'barbell_straight_leg_deadlift',
      2: 'dumbbell_deadlift',
      3: 'dumbbell_single_leg_deadlift_to_row',
      4: 'dumbbell_straight_leg_deadlift',
      5: 'kettlebell_floor_to_shelf',
      6: 'one_arm_one_leg_deadlift',
      7: 'rack_pull',
      8: 'rotational_dumbbell_straight_leg_deadlift',
      9: 'single_arm_deadlift',
      10: 'single_leg_barbell_deadlift',
      11: 'single_leg_barbell_straight_leg_deadlift',
      12: 'single_leg_deadlift_with_barbell',
      13: 'single_leg_rdl_circuit',
      14: 'single_leg_romanian_deadlift_with_dumbbell',
      15: 'sumo_deadlift',
      16: 'sumo_deadlift_high_pull',
      17: 'trap_bar_deadlift',
      18: 'wide_grip_barbell_deadlift'
    },
    flye_exercise_name: {
      0: 'cable_crossover',
      1: 'decline_dumbbell_flye',
      2: 'dumbbell_flye',
      3: 'incline_dumbbell_flye',
      4: 'kettlebell_flye',
      5: 'kneeling_rear_flye',
      6: 'single_arm_standing_cable_reverse_flye',
      7: 'swiss_ball_dumbbell_flye',
      8: 'arm_rotations',
      9: 'hug_a_tree'
    },
    hip_raise_exercise_name: {
      0: 'barbell_hip_thrust_on_floor',
      1: 'barbell_hip_thrust_with_bench',
      2: 'bent_knee_swiss_ball_reverse_hip_raise',
      3: 'weighted_bent_knee_swiss_ball_reverse_hip_raise',
      4: 'bridge_with_leg_extension',
      5: 'weighted_bridge_with_leg_extension',
      6: 'clam_bridge',
      7: 'front_kick_tabletop',
      8: 'weighted_front_kick_tabletop',
      9: 'hip_extension_and_cross',
      10: 'weighted_hip_extension_and_cross',
      11: 'hip_raise',
      12: 'weighted_hip_raise',
      13: 'hip_raise_with_feet_on_swiss_ball',
      14: 'weighted_hip_raise_with_feet_on_swiss_ball',
      15: 'hip_raise_with_head_on_bosu_ball',
      16: 'weighted_hip_raise_with_head_on_bosu_ball',
      17: 'hip_raise_with_head_on_swiss_ball',
      18: 'weighted_hip_raise_with_head_on_swiss_ball',
      19: 'hip_raise_with_knee_squeeze',
      20: 'weighted_hip_raise_with_knee_squeeze',
      21: 'incline_rear_leg_extension',
      22: 'weighted_incline_rear_leg_extension',
      23: 'kettlebell_swing',
      24: 'marching_hip_raise',
      25: 'weighted_marching_hip_raise',
      26: 'marching_hip_raise_with_feet_on_a_swiss_ball',
      27: 'weighted_marching_hip_raise_with_feet_on_a_swiss_ball',
      28: 'reverse_hip_raise',
      29: 'weighted_reverse_hip_raise',
      30: 'single_leg_hip_raise',
      31: 'weighted_single_leg_hip_raise',
      32: 'single_leg_hip_raise_with_foot_on_bench',
      33: 'weighted_single_leg_hip_raise_with_foot_on_bench',
      34: 'single_leg_hip_raise_with_foot_on_bosu_ball',
      35: 'weighted_single_leg_hip_raise_with_foot_on_bosu_ball',
      36: 'single_leg_hip_raise_with_foot_on_foam_roller',
      37: 'weighted_single_leg_hip_raise_with_foot_on_foam_roller',
      38: 'single_leg_hip_raise_with_foot_on_medicine_ball',
      39: 'weighted_single_leg_hip_raise_with_foot_on_medicine_ball',
      40: 'single_leg_hip_raise_with_head_on_bosu_ball',
      41: 'weighted_single_leg_hip_raise_with_head_on_bosu_ball',
      42: 'weighted_clam_bridge',
      43: 'single_leg_swiss_ball_hip_raise_and_leg_curl',
      44: 'clams',
      45: 'inner_thigh_circles',
      46: 'inner_thigh_side_lift',
      47: 'leg_circles',
      48: 'leg_lift',
      49: 'leg_lift_in_external_rotation'
    },
    hip_stability_exercise_name: {
      0: 'band_side_lying_leg_raise',
      1: 'dead_bug',
      2: 'weighted_dead_bug',
      3: 'external_hip_raise',
      4: 'weighted_external_hip_raise',
      5: 'fire_hydrant_kicks',
      6: 'weighted_fire_hydrant_kicks',
      7: 'hip_circles',
      8: 'weighted_hip_circles',
      9: 'inner_thigh_lift',
      10: 'weighted_inner_thigh_lift',
      11: 'lateral_walks_with_band_at_ankles',
      12: 'pretzel_side_kick',
      13: 'weighted_pretzel_side_kick',
      14: 'prone_hip_internal_rotation',
      15: 'weighted_prone_hip_internal_rotation',
      16: 'quadruped',
      17: 'quadruped_hip_extension',
      18: 'weighted_quadruped_hip_extension',
      19: 'quadruped_with_leg_lift',
      20: 'weighted_quadruped_with_leg_lift',
      21: 'side_lying_leg_raise',
      22: 'weighted_side_lying_leg_raise',
      23: 'sliding_hip_adduction',
      24: 'weighted_sliding_hip_adduction',
      25: 'standing_adduction',
      26: 'weighted_standing_adduction',
      27: 'standing_cable_hip_abduction',
      28: 'standing_hip_abduction',
      29: 'weighted_standing_hip_abduction',
      30: 'standing_rear_leg_raise',
      31: 'weighted_standing_rear_leg_raise',
      32: 'supine_hip_internal_rotation',
      33: 'weighted_supine_hip_internal_rotation'
    },
    hip_swing_excercise_name: {
      0: 'single_arm_kettlebell_swing',
      1: 'single_arm_dumbbell_swing',
      2: 'step_out_swing'
    },
    hyperextension_exercise_name: {
      0: 'back_extension_with_opposite_arm_and_leg_reach',
      1: 'weighted_back_extension_with_opposite_arm_and_leg_reach',
      2: 'base_rotations',
      3: 'weighted_base_rotations',
      4: 'bent_knee_reverse_hyperextension',
      5: 'weighted_bent_knee_reverse_hyperextension',
      6: 'hollow_hold_and_roll',
      7: 'weighted_hollow_hold_and_roll',
      8: 'kicks',
      9: 'weighted_kicks',
      10: 'knee_raises',
      11: 'weighted_knee_raises',
      12: 'kneeling_superman',
      13: 'weighted_kneeling_superman',
      14: 'lat_pull_down_with_row',
      15: 'medicine_ball_deadlift_to_reach',
      16: 'one_arm_one_leg_row',
      17: 'one_arm_row_with_band',
      18: 'overhead_lunge_with_medicine_ball',
      19: 'plank_knee_tucks',
      20: 'weighted_plank_knee_tucks',
      21: 'side_step',
      22: 'weighted_side_step',
      23: 'single_leg_back_extension',
      24: 'weighted_single_leg_back_extension',
      25: 'spine_extension',
      26: 'weighted_spine_extension',
      27: 'static_back_extension',
      28: 'weighted_static_back_extension',
      29: 'superman_from_floor',
      30: 'weighted_superman_from_floor',
      31: 'swiss_ball_back_extension',
      32: 'weighted_swiss_ball_back_extension',
      33: 'swiss_ball_hyperextension',
      34: 'weighted_swiss_ball_hyperextension',
      35: 'swiss_ball_opposite_arm_and_leg_lift',
      36: 'weighted_swiss_ball_opposite_arm_and_leg_lift',
      37: 'superman_on_swiss_ball',
      38: 'cobra',
      39: 'supine_floor_barre'
    },
    lateral_raise_exercise_name: {
      0: '45_degree_cable_external_rotation',
      1: 'alternating_lateral_raise_with_static_hold',
      2: 'bar_muscle_up',
      3: 'bent_over_lateral_raise',
      4: 'cable_diagonal_raise',
      5: 'cable_front_raise',
      6: 'calorie_row',
      7: 'combo_shoulder_raise',
      8: 'dumbbell_diagonal_raise',
      9: 'dumbbell_v_raise',
      10: 'front_raise',
      11: 'leaning_dumbbell_lateral_raise',
      12: 'lying_dumbbell_raise',
      13: 'muscle_up',
      14: 'one_arm_cable_lateral_raise',
      15: 'overhand_grip_rear_lateral_raise',
      16: 'plate_raises',
      17: 'ring_dip',
      18: 'weighted_ring_dip',
      19: 'ring_muscle_up',
      20: 'weighted_ring_muscle_up',
      21: 'rope_climb',
      22: 'weighted_rope_climb',
      23: 'scaption',
      24: 'seated_lateral_raise',
      25: 'seated_rear_lateral_raise',
      26: 'side_lying_lateral_raise',
      27: 'standing_lift',
      28: 'suspended_row',
      29: 'underhand_grip_rear_lateral_raise',
      30: 'wall_slide',
      31: 'weighted_wall_slide',
      32: 'arm_circles',
      33: 'shaving_the_head'
    },
    leg_curl_exercise_name: {
      0: 'leg_curl',
      1: 'weighted_leg_curl',
      2: 'good_morning',
      3: 'seated_barbell_good_morning',
      4: 'single_leg_barbell_good_morning',
      5: 'single_leg_sliding_leg_curl',
      6: 'sliding_leg_curl',
      7: 'split_barbell_good_morning',
      8: 'split_stance_extension',
      9: 'staggered_stance_good_morning',
      10: 'swiss_ball_hip_raise_and_leg_curl',
      11: 'zercher_good_morning'
    },
    leg_raise_exercise_name: {
      0: 'hanging_knee_raise',
      1: 'hanging_leg_raise',
      2: 'weighted_hanging_leg_raise',
      3: 'hanging_single_leg_raise',
      4: 'weighted_hanging_single_leg_raise',
      5: 'kettlebell_leg_raises',
      6: 'leg_lowering_drill',
      7: 'weighted_leg_lowering_drill',
      8: 'lying_straight_leg_raise',
      9: 'weighted_lying_straight_leg_raise',
      10: 'medicine_ball_leg_drops',
      11: 'quadruped_leg_raise',
      12: 'weighted_quadruped_leg_raise',
      13: 'reverse_leg_raise',
      14: 'weighted_reverse_leg_raise',
      15: 'reverse_leg_raise_on_swiss_ball',
      16: 'weighted_reverse_leg_raise_on_swiss_ball',
      17: 'single_leg_lowering_drill',
      18: 'weighted_single_leg_lowering_drill',
      19: 'weighted_hanging_knee_raise',
      20: 'lateral_stepover',
      21: 'weighted_lateral_stepover'
    },
    lunge_exercise_name: {
      0: 'overhead_lunge',
      1: 'lunge_matrix',
      2: 'weighted_lunge_matrix',
      3: 'alternating_barbell_forward_lunge',
      4: 'alternating_dumbbell_lunge_with_reach',
      5: 'back_foot_elevated_dumbbell_split_squat',
      6: 'barbell_box_lunge',
      7: 'barbell_bulgarian_split_squat',
      8: 'barbell_crossover_lunge',
      9: 'barbell_front_split_squat',
      10: 'barbell_lunge',
      11: 'barbell_reverse_lunge',
      12: 'barbell_side_lunge',
      13: 'barbell_split_squat',
      14: 'core_control_rear_lunge',
      15: 'diagonal_lunge',
      16: 'drop_lunge',
      17: 'dumbbell_box_lunge',
      18: 'dumbbell_bulgarian_split_squat',
      19: 'dumbbell_crossover_lunge',
      20: 'dumbbell_diagonal_lunge',
      21: 'dumbbell_lunge',
      22: 'dumbbell_lunge_and_rotation',
      23: 'dumbbell_overhead_bulgarian_split_squat',
      24: 'dumbbell_reverse_lunge_to_high_knee_and_press',
      25: 'dumbbell_side_lunge',
      26: 'elevated_front_foot_barbell_split_squat',
      27: 'front_foot_elevated_dumbbell_split_squat',
      28: 'gunslinger_lunge',
      29: 'lawnmower_lunge',
      30: 'low_lunge_with_isometric_adduction',
      31: 'low_side_to_side_lunge',
      32: 'lunge',
      33: 'weighted_lunge',
      34: 'lunge_with_arm_reach',
      35: 'lunge_with_diagonal_reach',
      36: 'lunge_with_side_bend',
      37: 'offset_dumbbell_lunge',
      38: 'offset_dumbbell_reverse_lunge',
      39: 'overhead_bulgarian_split_squat',
      40: 'overhead_dumbbell_reverse_lunge',
      41: 'overhead_dumbbell_split_squat',
      42: 'overhead_lunge_with_rotation',
      43: 'reverse_barbell_box_lunge',
      44: 'reverse_box_lunge',
      45: 'reverse_dumbbell_box_lunge',
      46: 'reverse_dumbbell_crossover_lunge',
      47: 'reverse_dumbbell_diagonal_lunge',
      48: 'reverse_lunge_with_reach_back',
      49: 'weighted_reverse_lunge_with_reach_back',
      50: 'reverse_lunge_with_twist_and_overhead_reach',
      51: 'weighted_reverse_lunge_with_twist_and_overhead_reach',
      52: 'reverse_sliding_box_lunge',
      53: 'weighted_reverse_sliding_box_lunge',
      54: 'reverse_sliding_lunge',
      55: 'weighted_reverse_sliding_lunge',
      56: 'runners_lunge_to_balance',
      57: 'weighted_runners_lunge_to_balance',
      58: 'shifting_side_lunge',
      59: 'side_and_crossover_lunge',
      60: 'weighted_side_and_crossover_lunge',
      61: 'side_lunge',
      62: 'weighted_side_lunge',
      63: 'side_lunge_and_press',
      64: 'side_lunge_jump_off',
      65: 'side_lunge_sweep',
      66: 'weighted_side_lunge_sweep',
      67: 'side_lunge_to_crossover_tap',
      68: 'weighted_side_lunge_to_crossover_tap',
      69: 'side_to_side_lunge_chops',
      70: 'weighted_side_to_side_lunge_chops',
      71: 'siff_jump_lunge',
      72: 'weighted_siff_jump_lunge',
      73: 'single_arm_reverse_lunge_and_press',
      74: 'sliding_lateral_lunge',
      75: 'weighted_sliding_lateral_lunge',
      76: 'walking_barbell_lunge',
      77: 'walking_dumbbell_lunge',
      78: 'walking_lunge',
      79: 'weighted_walking_lunge',
      80: 'wide_grip_overhead_barbell_split_squat'
    },
    olympic_lift_exercise_name: {
      0: 'barbell_hang_power_clean',
      1: 'barbell_hang_squat_clean',
      2: 'barbell_power_clean',
      3: 'barbell_power_snatch',
      4: 'barbell_squat_clean',
      5: 'clean_and_jerk',
      6: 'barbell_hang_power_snatch',
      7: 'barbell_hang_pull',
      8: 'barbell_high_pull',
      9: 'barbell_snatch',
      10: 'barbell_split_jerk',
      11: 'clean',
      12: 'dumbbell_clean',
      13: 'dumbbell_hang_pull',
      14: 'one_hand_dumbbell_split_snatch',
      15: 'push_jerk',
      16: 'single_arm_dumbbell_snatch',
      17: 'single_arm_hang_snatch',
      18: 'single_arm_kettlebell_snatch',
      19: 'split_jerk',
      20: 'squat_clean_and_jerk'
    },
    plank_exercise_name: {
      0: '45_degree_plank',
      1: 'weighted_45_degree_plank',
      2: '90_degree_static_hold',
      3: 'weighted_90_degree_static_hold',
      4: 'bear_crawl',
      5: 'weighted_bear_crawl',
      6: 'cross_body_mountain_climber',
      7: 'weighted_cross_body_mountain_climber',
      8: 'elbow_plank_pike_jacks',
      9: 'weighted_elbow_plank_pike_jacks',
      10: 'elevated_feet_plank',
      11: 'weighted_elevated_feet_plank',
      12: 'elevator_abs',
      13: 'weighted_elevator_abs',
      14: 'extended_plank',
      15: 'weighted_extended_plank',
      16: 'full_plank_passe_twist',
      17: 'weighted_full_plank_passe_twist',
      18: 'inching_elbow_plank',
      19: 'weighted_inching_elbow_plank',
      20: 'inchworm_to_side_plank',
      21: 'weighted_inchworm_to_side_plank',
      22: 'kneeling_plank',
      23: 'weighted_kneeling_plank',
      24: 'kneeling_side_plank_with_leg_lift',
      25: 'weighted_kneeling_side_plank_with_leg_lift',
      26: 'lateral_roll',
      27: 'weighted_lateral_roll',
      28: 'lying_reverse_plank',
      29: 'weighted_lying_reverse_plank',
      30: 'medicine_ball_mountain_climber',
      31: 'weighted_medicine_ball_mountain_climber',
      32: 'modified_mountain_climber_and_extension',
      33: 'weighted_modified_mountain_climber_and_extension',
      34: 'mountain_climber',
      35: 'weighted_mountain_climber',
      36: 'mountain_climber_on_sliding_discs',
      37: 'weighted_mountain_climber_on_sliding_discs',
      38: 'mountain_climber_with_feet_on_bosu_ball',
      39: 'weighted_mountain_climber_with_feet_on_bosu_ball',
      40: 'mountain_climber_with_hands_on_bench',
      41: 'mountain_climber_with_hands_on_swiss_ball',
      42: 'weighted_mountain_climber_with_hands_on_swiss_ball',
      43: 'plank',
      44: 'plank_jacks_with_feet_on_sliding_discs',
      45: 'weighted_plank_jacks_with_feet_on_sliding_discs',
      46: 'plank_knee_twist',
      47: 'weighted_plank_knee_twist',
      48: 'plank_pike_jumps',
      49: 'weighted_plank_pike_jumps',
      50: 'plank_pikes',
      51: 'weighted_plank_pikes',
      52: 'plank_to_stand_up',
      53: 'weighted_plank_to_stand_up',
      54: 'plank_with_arm_raise',
      55: 'weighted_plank_with_arm_raise',
      56: 'plank_with_knee_to_elbow',
      57: 'weighted_plank_with_knee_to_elbow',
      58: 'plank_with_oblique_crunch',
      59: 'weighted_plank_with_oblique_crunch',
      60: 'plyometric_side_plank',
      61: 'weighted_plyometric_side_plank',
      62: 'rolling_side_plank',
      63: 'weighted_rolling_side_plank',
      64: 'side_kick_plank',
      65: 'weighted_side_kick_plank',
      66: 'side_plank',
      67: 'weighted_side_plank',
      68: 'side_plank_and_row',
      69: 'weighted_side_plank_and_row',
      70: 'side_plank_lift',
      71: 'weighted_side_plank_lift',
      72: 'side_plank_with_elbow_on_bosu_ball',
      73: 'weighted_side_plank_with_elbow_on_bosu_ball',
      74: 'side_plank_with_feet_on_bench',
      75: 'weighted_side_plank_with_feet_on_bench',
      76: 'side_plank_with_knee_circle',
      77: 'weighted_side_plank_with_knee_circle',
      78: 'side_plank_with_knee_tuck',
      79: 'weighted_side_plank_with_knee_tuck',
      80: 'side_plank_with_leg_lift',
      81: 'weighted_side_plank_with_leg_lift',
      82: 'side_plank_with_reach_under',
      83: 'weighted_side_plank_with_reach_under',
      84: 'single_leg_elevated_feet_plank',
      85: 'weighted_single_leg_elevated_feet_plank',
      86: 'single_leg_flex_and_extend',
      87: 'weighted_single_leg_flex_and_extend',
      88: 'single_leg_side_plank',
      89: 'weighted_single_leg_side_plank',
      90: 'spiderman_plank',
      91: 'weighted_spiderman_plank',
      92: 'straight_arm_plank',
      93: 'weighted_straight_arm_plank',
      94: 'straight_arm_plank_with_shoulder_touch',
      95: 'weighted_straight_arm_plank_with_shoulder_touch',
      96: 'swiss_ball_plank',
      97: 'weighted_swiss_ball_plank',
      98: 'swiss_ball_plank_leg_lift',
      99: 'weighted_swiss_ball_plank_leg_lift',
      100: 'swiss_ball_plank_leg_lift_and_hold',
      101: 'swiss_ball_plank_with_feet_on_bench',
      102: 'weighted_swiss_ball_plank_with_feet_on_bench',
      103: 'swiss_ball_prone_jackknife',
      104: 'weighted_swiss_ball_prone_jackknife',
      105: 'swiss_ball_side_plank',
      106: 'weighted_swiss_ball_side_plank',
      107: 'three_way_plank',
      108: 'weighted_three_way_plank',
      109: 'towel_plank_and_knee_in',
      110: 'weighted_towel_plank_and_knee_in',
      111: 't_stabilization',
      112: 'weighted_t_stabilization',
      113: 'turkish_get_up_to_side_plank',
      114: 'weighted_turkish_get_up_to_side_plank',
      115: 'two_point_plank',
      116: 'weighted_two_point_plank',
      117: 'weighted_plank',
      118: 'wide_stance_plank_with_diagonal_arm_lift',
      119: 'weighted_wide_stance_plank_with_diagonal_arm_lift',
      120: 'wide_stance_plank_with_diagonal_leg_lift',
      121: 'weighted_wide_stance_plank_with_diagonal_leg_lift',
      122: 'wide_stance_plank_with_leg_lift',
      123: 'weighted_wide_stance_plank_with_leg_lift',
      124: 'wide_stance_plank_with_opposite_arm_and_leg_lift',
      125: 'weighted_mountain_climber_with_hands_on_bench',
      126: 'weighted_swiss_ball_plank_leg_lift_and_hold',
      127: 'weighted_wide_stance_plank_with_opposite_arm_and_leg_lift',
      128: 'plank_with_feet_on_swiss_ball',
      129: 'side_plank_to_plank_with_reach_under',
      130: 'bridge_with_glute_lower_lift',
      131: 'bridge_one_leg_bridge',
      132: 'plank_with_arm_variations',
      133: 'plank_with_leg_lift',
      134: 'reverse_plank_with_leg_pull'
    },
    plyo_exercise_name: {
      0: 'alternating_jump_lunge',
      1: 'weighted_alternating_jump_lunge',
      2: 'barbell_jump_squat',
      3: 'body_weight_jump_squat',
      4: 'weighted_jump_squat',
      5: 'cross_knee_strike',
      6: 'weighted_cross_knee_strike',
      7: 'depth_jump',
      8: 'weighted_depth_jump',
      9: 'dumbbell_jump_squat',
      10: 'dumbbell_split_jump',
      11: 'front_knee_strike',
      12: 'weighted_front_knee_strike',
      13: 'high_box_jump',
      14: 'weighted_high_box_jump',
      15: 'isometric_explosive_body_weight_jump_squat',
      16: 'weighted_isometric_explosive_jump_squat',
      17: 'lateral_leap_and_hop',
      18: 'weighted_lateral_leap_and_hop',
      19: 'lateral_plyo_squats',
      20: 'weighted_lateral_plyo_squats',
      21: 'lateral_slide',
      22: 'weighted_lateral_slide',
      23: 'medicine_ball_overhead_throws',
      24: 'medicine_ball_side_throw',
      25: 'medicine_ball_slam',
      26: 'side_to_side_medicine_ball_throws',
      27: 'side_to_side_shuffle_jump',
      28: 'weighted_side_to_side_shuffle_jump',
      29: 'squat_jump_onto_box',
      30: 'weighted_squat_jump_onto_box',
      31: 'squat_jumps_in_and_out',
      32: 'weighted_squat_jumps_in_and_out'
    },
    pull_up_exercise_name: {
      0: 'banded_pull_ups',
      1: '30_degree_lat_pulldown',
      2: 'band_assisted_chin_up',
      3: 'close_grip_chin_up',
      4: 'weighted_close_grip_chin_up',
      5: 'close_grip_lat_pulldown',
      6: 'crossover_chin_up',
      7: 'weighted_crossover_chin_up',
      8: 'ez_bar_pullover',
      9: 'hanging_hurdle',
      10: 'weighted_hanging_hurdle',
      11: 'kneeling_lat_pulldown',
      12: 'kneeling_underhand_grip_lat_pulldown',
      13: 'lat_pulldown',
      14: 'mixed_grip_chin_up',
      15: 'weighted_mixed_grip_chin_up',
      16: 'mixed_grip_pull_up',
      17: 'weighted_mixed_grip_pull_up',
      18: 'reverse_grip_pulldown',
      19: 'standing_cable_pullover',
      20: 'straight_arm_pulldown',
      21: 'swiss_ball_ez_bar_pullover',
      22: 'towel_pull_up',
      23: 'weighted_towel_pull_up',
      24: 'weighted_pull_up',
      25: 'wide_grip_lat_pulldown',
      26: 'wide_grip_pull_up',
      27: 'weighted_wide_grip_pull_up',
      28: 'burpee_pull_up',
      29: 'weighted_burpee_pull_up',
      30: 'jumping_pull_ups',
      31: 'weighted_jumping_pull_ups',
      32: 'kipping_pull_up',
      33: 'weighted_kipping_pull_up',
      34: 'l_pull_up',
      35: 'weighted_l_pull_up',
      36: 'suspended_chin_up',
      37: 'weighted_suspended_chin_up',
      38: 'pull_up'
    },
    push_up_exercise_name: {
      0: 'chest_press_with_band',
      1: 'alternating_staggered_push_up',
      2: 'weighted_alternating_staggered_push_up',
      3: 'alternating_hands_medicine_ball_push_up',
      4: 'weighted_alternating_hands_medicine_ball_push_up',
      5: 'bosu_ball_push_up',
      6: 'weighted_bosu_ball_push_up',
      7: 'clapping_push_up',
      8: 'weighted_clapping_push_up',
      9: 'close_grip_medicine_ball_push_up',
      10: 'weighted_close_grip_medicine_ball_push_up',
      11: 'close_hands_push_up',
      12: 'weighted_close_hands_push_up',
      13: 'decline_push_up',
      14: 'weighted_decline_push_up',
      15: 'diamond_push_up',
      16: 'weighted_diamond_push_up',
      17: 'explosive_crossover_push_up',
      18: 'weighted_explosive_crossover_push_up',
      19: 'explosive_push_up',
      20: 'weighted_explosive_push_up',
      21: 'feet_elevated_side_to_side_push_up',
      22: 'weighted_feet_elevated_side_to_side_push_up',
      23: 'hand_release_push_up',
      24: 'weighted_hand_release_push_up',
      25: 'handstand_push_up',
      26: 'weighted_handstand_push_up',
      27: 'incline_push_up',
      28: 'weighted_incline_push_up',
      29: 'isometric_explosive_push_up',
      30: 'weighted_isometric_explosive_push_up',
      31: 'judo_push_up',
      32: 'weighted_judo_push_up',
      33: 'kneeling_push_up',
      34: 'weighted_kneeling_push_up',
      35: 'medicine_ball_chest_pass',
      36: 'medicine_ball_push_up',
      37: 'weighted_medicine_ball_push_up',
      38: 'one_arm_push_up',
      39: 'weighted_one_arm_push_up',
      40: 'weighted_push_up',
      41: 'push_up_and_row',
      42: 'weighted_push_up_and_row',
      43: 'push_up_plus',
      44: 'weighted_push_up_plus',
      45: 'push_up_with_feet_on_swiss_ball',
      46: 'weighted_push_up_with_feet_on_swiss_ball',
      47: 'push_up_with_one_hand_on_medicine_ball',
      48: 'weighted_push_up_with_one_hand_on_medicine_ball',
      49: 'shoulder_push_up',
      50: 'weighted_shoulder_push_up',
      51: 'single_arm_medicine_ball_push_up',
      52: 'weighted_single_arm_medicine_ball_push_up',
      53: 'spiderman_push_up',
      54: 'weighted_spiderman_push_up',
      55: 'stacked_feet_push_up',
      56: 'weighted_stacked_feet_push_up',
      57: 'staggered_hands_push_up',
      58: 'weighted_staggered_hands_push_up',
      59: 'suspended_push_up',
      60: 'weighted_suspended_push_up',
      61: 'swiss_ball_push_up',
      62: 'weighted_swiss_ball_push_up',
      63: 'swiss_ball_push_up_plus',
      64: 'weighted_swiss_ball_push_up_plus',
      65: 't_push_up',
      66: 'weighted_t_push_up',
      67: 'triple_stop_push_up',
      68: 'weighted_triple_stop_push_up',
      69: 'wide_hands_push_up',
      70: 'weighted_wide_hands_push_up',
      71: 'parallette_handstand_push_up',
      72: 'weighted_parallette_handstand_push_up',
      73: 'ring_handstand_push_up',
      74: 'weighted_ring_handstand_push_up',
      75: 'ring_push_up',
      76: 'weighted_ring_push_up',
      77: 'push_up',
      78: 'pilates_pushup'
    },
    row_exercise_name: {
      0: 'barbell_straight_leg_deadlift_to_row',
      1: 'cable_row_standing',
      2: 'dumbbell_row',
      3: 'elevated_feet_inverted_row',
      4: 'weighted_elevated_feet_inverted_row',
      5: 'face_pull',
      6: 'face_pull_with_external_rotation',
      7: 'inverted_row_with_feet_on_swiss_ball',
      8: 'weighted_inverted_row_with_feet_on_swiss_ball',
      9: 'kettlebell_row',
      10: 'modified_inverted_row',
      11: 'weighted_modified_inverted_row',
      12: 'neutral_grip_alternating_dumbbell_row',
      13: 'one_arm_bent_over_row',
      14: 'one_legged_dumbbell_row',
      15: 'renegade_row',
      16: 'reverse_grip_barbell_row',
      17: 'rope_handle_cable_row',
      18: 'seated_cable_row',
      19: 'seated_dumbbell_row',
      20: 'single_arm_cable_row',
      21: 'single_arm_cable_row_and_rotation',
      22: 'single_arm_inverted_row',
      23: 'weighted_single_arm_inverted_row',
      24: 'single_arm_neutral_grip_dumbbell_row',
      25: 'single_arm_neutral_grip_dumbbell_row_and_rotation',
      26: 'suspended_inverted_row',
      27: 'weighted_suspended_inverted_row',
      28: 't_bar_row',
      29: 'towel_grip_inverted_row',
      30: 'weighted_towel_grip_inverted_row',
      31: 'underhand_grip_cable_row',
      32: 'v_grip_cable_row',
      33: 'wide_grip_seated_cable_row'
    },
    shoulder_press_exercise_name: {
      0: 'alternating_dumbbell_shoulder_press',
      1: 'arnold_press',
      2: 'barbell_front_squat_to_push_press',
      3: 'barbell_push_press',
      4: 'barbell_shoulder_press',
      5: 'dead_curl_press',
      6: 'dumbbell_alternating_shoulder_press_and_twist',
      7: 'dumbbell_hammer_curl_to_lunge_to_press',
      8: 'dumbbell_push_press',
      9: 'floor_inverted_shoulder_press',
      10: 'weighted_floor_inverted_shoulder_press',
      11: 'inverted_shoulder_press',
      12: 'weighted_inverted_shoulder_press',
      13: 'one_arm_push_press',
      14: 'overhead_barbell_press',
      15: 'overhead_dumbbell_press',
      16: 'seated_barbell_shoulder_press',
      17: 'seated_dumbbell_shoulder_press',
      18: 'single_arm_dumbbell_shoulder_press',
      19: 'single_arm_step_up_and_press',
      20: 'smith_machine_overhead_press',
      21: 'split_stance_hammer_curl_to_press',
      22: 'swiss_ball_dumbbell_shoulder_press',
      23: 'weight_plate_front_raise'
    },
    shoulder_stability_exercise_name: {
      0: '90_degree_cable_external_rotation',
      1: 'band_external_rotation',
      2: 'band_internal_rotation',
      3: 'bent_arm_lateral_raise_and_external_rotation',
      4: 'cable_external_rotation',
      5: 'dumbbell_face_pull_with_external_rotation',
      6: 'floor_i_raise',
      7: 'weighted_floor_i_raise',
      8: 'floor_t_raise',
      9: 'weighted_floor_t_raise',
      10: 'floor_y_raise',
      11: 'weighted_floor_y_raise',
      12: 'incline_i_raise',
      13: 'weighted_incline_i_raise',
      14: 'incline_l_raise',
      15: 'weighted_incline_l_raise',
      16: 'incline_t_raise',
      17: 'weighted_incline_t_raise',
      18: 'incline_w_raise',
      19: 'weighted_incline_w_raise',
      20: 'incline_y_raise',
      21: 'weighted_incline_y_raise',
      22: 'lying_external_rotation',
      23: 'seated_dumbbell_external_rotation',
      24: 'standing_l_raise',
      25: 'swiss_ball_i_raise',
      26: 'weighted_swiss_ball_i_raise',
      27: 'swiss_ball_t_raise',
      28: 'weighted_swiss_ball_t_raise',
      29: 'swiss_ball_w_raise',
      30: 'weighted_swiss_ball_w_raise',
      31: 'swiss_ball_y_raise',
      32: 'weighted_swiss_ball_y_raise'
    },
    shrug_exercise_name: {
      0: 'barbell_jump_shrug',
      1: 'barbell_shrug',
      2: 'barbell_upright_row',
      3: 'behind_the_back_smith_machine_shrug',
      4: 'dumbbell_jump_shrug',
      5: 'dumbbell_shrug',
      6: 'dumbbell_upright_row',
      7: 'incline_dumbbell_shrug',
      8: 'overhead_barbell_shrug',
      9: 'overhead_dumbbell_shrug',
      10: 'scaption_and_shrug',
      11: 'scapular_retraction',
      12: 'serratus_chair_shrug',
      13: 'weighted_serratus_chair_shrug',
      14: 'serratus_shrug',
      15: 'weighted_serratus_shrug',
      16: 'wide_grip_jump_shrug'
    },
    sit_up_exercise_name: {
      0: 'alternating_sit_up',
      1: 'weighted_alternating_sit_up',
      2: 'bent_knee_v_up',
      3: 'weighted_bent_knee_v_up',
      4: 'butterfly_sit_up',
      5: 'weighted_butterfly_situp',
      6: 'cross_punch_roll_up',
      7: 'weighted_cross_punch_roll_up',
      8: 'crossed_arms_sit_up',
      9: 'weighted_crossed_arms_sit_up',
      10: 'get_up_sit_up',
      11: 'weighted_get_up_sit_up',
      12: 'hovering_sit_up',
      13: 'weighted_hovering_sit_up',
      14: 'kettlebell_sit_up',
      15: 'medicine_ball_alternating_v_up',
      16: 'medicine_ball_sit_up',
      17: 'medicine_ball_v_up',
      18: 'modified_sit_up',
      19: 'negative_sit_up',
      20: 'one_arm_full_sit_up',
      21: 'reclining_circle',
      22: 'weighted_reclining_circle',
      23: 'reverse_curl_up',
      24: 'weighted_reverse_curl_up',
      25: 'single_leg_swiss_ball_jackknife',
      26: 'weighted_single_leg_swiss_ball_jackknife',
      27: 'the_teaser',
      28: 'the_teaser_weighted',
      29: 'three_part_roll_down',
      30: 'weighted_three_part_roll_down',
      31: 'v_up',
      32: 'weighted_v_up',
      33: 'weighted_russian_twist_on_swiss_ball',
      34: 'weighted_sit_up',
      35: 'x_abs',
      36: 'weighted_x_abs',
      37: 'sit_up'
    },
    squat_exercise_name: {
      0: 'leg_press',
      1: 'back_squat_with_body_bar',
      2: 'back_squats',
      3: 'weighted_back_squats',
      4: 'balancing_squat',
      5: 'weighted_balancing_squat',
      6: 'barbell_back_squat',
      7: 'barbell_box_squat',
      8: 'barbell_front_squat',
      9: 'barbell_hack_squat',
      10: 'barbell_hang_squat_snatch',
      11: 'barbell_lateral_step_up',
      12: 'barbell_quarter_squat',
      13: 'barbell_siff_squat',
      14: 'barbell_squat_snatch',
      15: 'barbell_squat_with_heels_raised',
      16: 'barbell_stepover',
      17: 'barbell_step_up',
      18: 'bench_squat_with_rotational_chop',
      19: 'weighted_bench_squat_with_rotational_chop',
      20: 'body_weight_wall_squat',
      21: 'weighted_wall_squat',
      22: 'box_step_squat',
      23: 'weighted_box_step_squat',
      24: 'braced_squat',
      25: 'crossed_arm_barbell_front_squat',
      26: 'crossover_dumbbell_step_up',
      27: 'dumbbell_front_squat',
      28: 'dumbbell_split_squat',
      29: 'dumbbell_squat',
      30: 'dumbbell_squat_clean',
      31: 'dumbbell_stepover',
      32: 'dumbbell_step_up',
      33: 'elevated_single_leg_squat',
      34: 'weighted_elevated_single_leg_squat',
      35: 'figure_four_squats',
      36: 'weighted_figure_four_squats',
      37: 'goblet_squat',
      38: 'kettlebell_squat',
      39: 'kettlebell_swing_overhead',
      40: 'kettlebell_swing_with_flip_to_squat',
      41: 'lateral_dumbbell_step_up',
      42: 'one_legged_squat',
      43: 'overhead_dumbbell_squat',
      44: 'overhead_squat',
      45: 'partial_single_leg_squat',
      46: 'weighted_partial_single_leg_squat',
      47: 'pistol_squat',
      48: 'weighted_pistol_squat',
      49: 'plie_slides',
      50: 'weighted_plie_slides',
      51: 'plie_squat',
      52: 'weighted_plie_squat',
      53: 'prisoner_squat',
      54: 'weighted_prisoner_squat',
      55: 'single_leg_bench_get_up',
      56: 'weighted_single_leg_bench_get_up',
      57: 'single_leg_bench_squat',
      58: 'weighted_single_leg_bench_squat',
      59: 'single_leg_squat_on_swiss_ball',
      60: 'weighted_single_leg_squat_on_swiss_ball',
      61: 'squat',
      62: 'weighted_squat',
      63: 'squats_with_band',
      64: 'staggered_squat',
      65: 'weighted_staggered_squat',
      66: 'step_up',
      67: 'weighted_step_up',
      68: 'suitcase_squats',
      69: 'sumo_squat',
      70: 'sumo_squat_slide_in',
      71: 'weighted_sumo_squat_slide_in',
      72: 'sumo_squat_to_high_pull',
      73: 'sumo_squat_to_stand',
      74: 'weighted_sumo_squat_to_stand',
      75: 'sumo_squat_with_rotation',
      76: 'weighted_sumo_squat_with_rotation',
      77: 'swiss_ball_body_weight_wall_squat',
      78: 'weighted_swiss_ball_wall_squat',
      79: 'thrusters',
      80: 'uneven_squat',
      81: 'weighted_uneven_squat',
      82: 'waist_slimming_squat',
      83: 'wall_ball',
      84: 'wide_stance_barbell_squat',
      85: 'wide_stance_goblet_squat',
      86: 'zercher_squat',
      87: 'kbs_overhead',
      88: 'squat_and_side_kick',
      89: 'squat_jumps_in_n_out',
      90: 'pilates_plie_squats_parallel_turned_out_flat_and_heels',
      91: 'releve_straight_leg_and_knee_bent_with_one_leg_variation'
    },
    total_body_exercise_name: {
      0: 'burpee',
      1: 'weighted_burpee',
      2: 'burpee_box_jump',
      3: 'weighted_burpee_box_jump',
      4: 'high_pull_burpee',
      5: 'man_makers',
      6: 'one_arm_burpee',
      7: 'squat_thrusts',
      8: 'weighted_squat_thrusts',
      9: 'squat_plank_push_up',
      10: 'weighted_squat_plank_push_up',
      11: 'standing_t_rotation_balance',
      12: 'weighted_standing_t_rotation_balance'
    },
    triceps_extension_exercise_name: {
      0: 'bench_dip',
      1: 'weighted_bench_dip',
      2: 'body_weight_dip',
      3: 'cable_kickback',
      4: 'cable_lying_triceps_extension',
      5: 'cable_overhead_triceps_extension',
      6: 'dumbbell_kickback',
      7: 'dumbbell_lying_triceps_extension',
      8: 'ez_bar_overhead_triceps_extension',
      9: 'incline_dip',
      10: 'weighted_incline_dip',
      11: 'incline_ez_bar_lying_triceps_extension',
      12: 'lying_dumbbell_pullover_to_extension',
      13: 'lying_ez_bar_triceps_extension',
      14: 'lying_triceps_extension_to_close_grip_bench_press',
      15: 'overhead_dumbbell_triceps_extension',
      16: 'reclining_triceps_press',
      17: 'reverse_grip_pressdown',
      18: 'reverse_grip_triceps_pressdown',
      19: 'rope_pressdown',
      20: 'seated_barbell_overhead_triceps_extension',
      21: 'seated_dumbbell_overhead_triceps_extension',
      22: 'seated_ez_bar_overhead_triceps_extension',
      23: 'seated_single_arm_overhead_dumbbell_extension',
      24: 'single_arm_dumbbell_overhead_triceps_extension',
      25: 'single_dumbbell_seated_overhead_triceps_extension',
      26: 'single_leg_bench_dip_and_kick',
      27: 'weighted_single_leg_bench_dip_and_kick',
      28: 'single_leg_dip',
      29: 'weighted_single_leg_dip',
      30: 'static_lying_triceps_extension',
      31: 'suspended_dip',
      32: 'weighted_suspended_dip',
      33: 'swiss_ball_dumbbell_lying_triceps_extension',
      34: 'swiss_ball_ez_bar_lying_triceps_extension',
      35: 'swiss_ball_ez_bar_overhead_triceps_extension',
      36: 'tabletop_dip',
      37: 'weighted_tabletop_dip',
      38: 'triceps_extension_on_floor',
      39: 'triceps_pressdown',
      40: 'weighted_dip'
    },
    warm_up_exercise_name: {
      0: 'quadruped_rocking',
      1: 'neck_tilts',
      2: 'ankle_circles',
      3: 'ankle_dorsiflexion_with_band',
      4: 'ankle_internal_rotation',
      5: 'arm_circles',
      6: 'bent_over_reach_to_sky',
      7: 'cat_camel',
      8: 'elbow_to_foot_lunge',
      9: 'forward_and_backward_leg_swings',
      10: 'groiners',
      11: 'inverted_hamstring_stretch',
      12: 'lateral_duck_under',
      13: 'neck_rotations',
      14: 'opposite_arm_and_leg_balance',
      15: 'reach_roll_and_lift',
      16: 'scorpion',
      17: 'shoulder_circles',
      18: 'side_to_side_leg_swings',
      19: 'sleeper_stretch',
      20: 'slide_out',
      21: 'swiss_ball_hip_crossover',
      22: 'swiss_ball_reach_roll_and_lift',
      23: 'swiss_ball_windshield_wipers',
      24: 'thoracic_rotation',
      25: 'walking_high_kicks',
      26: 'walking_high_knees',
      27: 'walking_knee_hugs',
      28: 'walking_leg_cradles',
      29: 'walkout',
      30: 'walkout_from_push_up_position'
    },
    run_exercise_name: {
      0: 'run',
      1: 'walk',
      2: 'jog',
      3: 'sprint'
    },
    water_type: {
      0: 'fresh',
      1: 'salt',
      2: 'en13319',
      3: 'custom'
    },
    tissue_model_type: {
      0: 'zhl_16c'
    },
    dive_gas_status: {
      0: 'disabled',
      1: 'enabled',
      2: 'backup_only'
    },
    dive_alarm_type: {
      0: 'depth',
      1: 'time'
    },
    dive_backlight_mode: {
      0: 'at_depth',
      1: 'always_on'
    },
    favero_product: {
      10: 'assioma_uno',
      12: 'assioma_duo'
    }
  }
};

function getMessageName(messageNum) {
  var message = FIT.messages[messageNum];
  return message ? message.name : '';
}

function getFieldObject(fieldNum, messageNum) {
  var message = FIT.messages[messageNum];
  if (!message) {
    return '';
  }
  var fieldObj = message[fieldNum];
  return fieldObj ? fieldObj : {};
}
},{}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFitMessage = getFitMessage;
exports.getFitMessageBaseType = getFitMessageBaseType;

var _fit = require('./fit');

function getFitMessage(messageNum) {
  return {
    name: (0, _fit.getMessageName)(messageNum),
    getAttributes: function getAttributes(fieldNum) {
      return (0, _fit.getFieldObject)(fieldNum, messageNum);
    }
  };
}

// TODO
function getFitMessageBaseType(foo) {
  return foo;
}
},{"./fit":2}],4:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],5:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var customInspectSymbol =
  (typeof Symbol === 'function' && typeof Symbol.for === 'function')
    ? Symbol.for('nodejs.util.inspect.custom')
    : null

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    var proto = { foo: function () { return 42 } }
    Object.setPrototypeOf(proto, Uint8Array.prototype)
    Object.setPrototypeOf(arr, proto)
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  Object.setPrototypeOf(buf, Buffer.prototype)
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype)
Object.setPrototypeOf(Buffer, Uint8Array)

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, Buffer.prototype)

  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}
if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]]
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, Buffer.prototype)

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  } else if (typeof val === 'boolean') {
    val = Number(val)
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

// Create lookup table for `toString('hex')`
// See: https://github.com/feross/buffer/issues/219
var hexSliceLookupTable = (function () {
  var alphabet = '0123456789abcdef'
  var table = new Array(256)
  for (var i = 0; i < 16; ++i) {
    var i16 = i * 16
    for (var j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j]
    }
  }
  return table
})()

}).call(this,require("buffer").Buffer)
},{"base64-js":4,"buffer":8,"ieee754":6}],6:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],7:[function(require,module,exports){
arguments[4][4][0].apply(exports,arguments)
},{"dup":4}],8:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"base64-js":7,"buffer":8,"dup":5,"ieee754":9}],9:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"dup":6}],"FitParser":[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _binary = require('./binary');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FitParser = function () {
  function FitParser() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, FitParser);

    this.options = {
      force: options.force != null ? options.force : true,
      speedUnit: options.speedUnit || 'm/s',
      lengthUnit: options.lengthUnit || 'm',
      temperatureUnit: options.temperatureUnit || 'celsius',
      elapsedRecordField: options.elapsedRecordField || false,
      mode: options.mode || 'list'
    };
  }

  _createClass(FitParser, [{
    key: 'parse',
    value: function parse(content, callback) {
      var blob = new Uint8Array((0, _binary.getArrayBuffer)(content));

      if (blob.length < 12) {
        callback('File to small to be a FIT file', {});
        if (!this.options.force) {
          return;
        }
      }

      var headerLength = blob[0];
      if (headerLength !== 14 && headerLength !== 12) {
        callback('Incorrect header size', {});
        if (!this.options.force) {
          return;
        }
      }

      var fileTypeString = '';
      for (var i = 8; i < 12; i++) {
        fileTypeString += String.fromCharCode(blob[i]);
      }
      if (fileTypeString !== '.FIT') {
        callback('Missing \'.FIT\' in header', {});
        if (!this.options.force) {
          return;
        }
      }

      if (headerLength === 14) {
        var crcHeader = blob[12] + (blob[13] << 8);
        var crcHeaderCalc = (0, _binary.calculateCRC)(blob, 0, 12);
        if (crcHeader !== crcHeaderCalc) {
          // callback('Header CRC mismatch', {});
          // TODO: fix Header CRC check
          if (!this.options.force) {
            return;
          }
        }
      }
      var dataLength = blob[4] + (blob[5] << 8) + (blob[6] << 16) + (blob[7] << 24);
      var crcStart = dataLength + headerLength;
      var crcFile = blob[crcStart] + (blob[crcStart + 1] << 8);
      var crcFileCalc = (0, _binary.calculateCRC)(blob, headerLength === 12 ? 0 : headerLength, crcStart);

      if (crcFile !== crcFileCalc) {
        // callback('File CRC mismatch', {});
        // TODO: fix File CRC check
        if (!this.options.force) {
          return;
        }
      }

      var fitObj = {};
      var sessions = [];
      var laps = [];
      var records = [];
      var events = [];
      var hrv = [];
      var devices = [];
      var applications = [];
      var fieldDescriptions = [];
      var dive_gases = [];
      var course_points = [];

      var tempLaps = [];
      var tempRecords = [];

      var loopIndex = headerLength;
      var messageTypes = [];
      var developerFields = [];

      var isModeCascade = this.options.mode === 'cascade';
      var isCascadeNeeded = isModeCascade || this.options.mode === 'both';

      var startDate = void 0,
          lastStopTimestamp = void 0;
      var pausedTime = 0;

      while (loopIndex < crcStart) {
        var _readRecord = (0, _binary.readRecord)(blob, messageTypes, developerFields, loopIndex, this.options, startDate, pausedTime),
            nextIndex = _readRecord.nextIndex,
            messageType = _readRecord.messageType,
            message = _readRecord.message;

        loopIndex = nextIndex;

        switch (messageType) {
          case 'lap':
            if (isCascadeNeeded) {
              message.records = tempRecords;
              tempRecords = [];
              tempLaps.push(message);
            }
            laps.push(message);
            break;
          case 'session':
            if (isCascadeNeeded) {
              message.laps = tempLaps;
              tempLaps = [];
            }
            sessions.push(message);
            break;
          case 'event':
            if (message.event === 'timer') {
              if (message.event_type === 'stop_all') {
                lastStopTimestamp = message.timestamp;
              } else if (message.event_type === 'start' && lastStopTimestamp) {
                pausedTime += (message.timestamp - lastStopTimestamp) / 1000;
              }
            }
            events.push(message);
            break;
          case 'hrv':
            hrv.push(message);
            break;
          case 'record':
            if (!startDate) {
              startDate = message.timestamp;
              message.elapsed_time = 0;
              message.timer_time = 0;
            }
            records.push(message);
            if (isCascadeNeeded) {
              tempRecords.push(message);
            }
            break;
          case 'field_description':
            fieldDescriptions.push(message);
            break;
          case 'device_info':
            devices.push(message);
            break;
          case 'developer_data_id':
            applications.push(message);
            break;
          case 'dive_gas':
            dive_gases.push(message);
            break;
          case 'course_point':
            course_points.push(message);
            break;
          default:
            if (messageType !== '') {
              fitObj[messageType] = message;
            }
            break;
        }
      }

      if (isCascadeNeeded) {
        fitObj.activity = fitObj.activity || {};
        fitObj.activity.sessions = sessions;
        fitObj.activity.events = events;
        fitObj.activity.hrv = hrv;
      }
      if (!isModeCascade) {
        fitObj.sessions = sessions;
        fitObj.laps = laps;
        fitObj.records = records;
        fitObj.events = events;
        fitObj.device_infos = devices;
        fitObj.developer_data_ids = applications;
        fitObj.field_descriptions = fieldDescriptions;
        fitObj.hrv = hrv;
        fitObj.dive_gases = dive_gases;
        fitObj.course_points = course_points;
      }

      callback(null, fitObj);
    }
  }]);

  return FitParser;
}();

exports.default = FitParser;
},{"./binary":1}]},{},[]);

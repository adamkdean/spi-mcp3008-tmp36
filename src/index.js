"use strict";

var util = require('util'),
    fs = require('fs'),
    SPI = require('spi');

var device = '/dev/spidev0.0',
    spi;

if (!fs.existsSync(device)) {
    throw 'Error, SPI is not activated';
}

function read(channel, callback) {
    if (spi === undefined) return;

    // to select the channel, we need to compute a mode (4 bits)
    // a mode consists of a single/diff bit and three selection bits (d2, d1, d0)
    // if we want the input configuration to be single-ended, we use 1, for differential, use 0
    // for the channel, if we add that to 8 (which is 0000 1000), we should get the right value
    // ch0 = 1000, ch1 = 1001, ch2 = 1010, ch3 = 1011
    // ch4 = 1100, ch5 = 1101, ch6 = 1110, ch7 = 1111
    // now we need to pad this with 4 bits, to give us a byte:
    // ch0 = 1000 << 4 = 1000 0000
    var mode = (8 + channel) << 4;

    var tx = new Buffer([1, mode, 0]);
    var rx = new Buffer([0, 0, 0]);

    spi.transfer(tx, rx, function(dev, buffer) {
        // logic explained:

        // the buffer will hold 3 8-bit bytes (24 bits) but we only want the last 10 bits
        // this is the last byte and the last 2 bits from the second byte, we ignore the first byte

        // |   0   | |   1   | |   2   |
        // 0000 0000 0000 0000 0000 0000
        //                 ^^^ ^^^^ ^^^^

        // step 1.
        // we take the second byte and bitwise AND it with 3 (0000 0011) to extract the last two bits
        //   1010 0010 (162)  let's say the byte has some junk data and then two at the end
        // & 0000 0011 (3)    we and it with three
        // = 0000 0010 (2)    and we get the value two

        // step 2.
        // we now want to shift these bits 8 to the left to make space for the third byte
        // byte 1 = 0000 0010 (2)  <- 8 = 10 0000 0000 (512)
        // byte 2 = 0000 1111 (15)           | space |

        // step 3.
        // we can now add them together to get two bytes equaling our value:
        // 0000 0010 0000 1111 (527)

        var value = ((buffer[1] & 3) << 8) + buffer[2];
        callback(value);
    })
}

function tmp36_temp(value) {
    // approx 25 C = 750 mV (0.75 V)
    // 25 / 0.75 = 33.33 C/V
    // I think? http://www.analog.com/static/imported-files/data_sheets/TMP35_36_37.pdf

    var volts = (value * 3.3) / 1023;
    var temp = volts * 33.333;
    return temp.toFixed(2);
}

function get_volts(value) {
    var volts = (value * 3.3) / 1023;
    return volts.toFixed(2);
}

spi = new SPI.Spi(device, [], function(s) {
    s.open();
});

// read from ch0
read(0, function(value) {
    console.log('Sensor 1 is %s C (%s - %s v)', tmp36_temp(value), value, get_volts(value));
})

// read from ch1
read(1, function(value) {
    console.log('Sensor 2 is %s C (%s - %s v)', tmp36_temp(value), value, get_volts(value));
})

spi.close();

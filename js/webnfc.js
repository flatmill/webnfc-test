(function (window) {
    'use struct';

    /** NDEFReader object */
    var _ndef = null;

    /** true if supports Web NFC */
    var _isSupported = 'NDEFReader' in window;
    if (_isSupported) {
        try {
            _ndef = new window.NDEFReader();
        } catch (error) {
            _isSupported = false;
        }
    }

    /** 'reading' listener of _ndef */
    var _readingListener = null;

    /** 'readingerror' listener of _ndef */
    var _readingErrorListener = null;

    /** true if NDEFReader is scanning. */
    var _isScanning = false;

    /** Controller for abort scan. */
    var _scanController = null;

    /** Entity of WebNFC.read function */
    var _readfunc = null;

    /** Entity of WebNFC.write function */
    var _writefunc = null;

    // Implement entities of WebNFC function
    if (_isSupported) {
        var finallyScan = function () {
            _isScanning = false;
            if (_readingListener) {
                _ndef.removeEventListener('reading', _readingListener);
            }
            if (_readingErrorListener) {
                _ndef.removeEventListener('readingerror', _readingErrorListener);
            }
            _ndef = null;
            _scanController = null;
            _readingListener = _readingErrorListener = null;
        };
        var callbackFailed = function (failed, error) {
            console.error(error);
            if (_isScanning) {
                finallyScan();
                failed(error);
            }
        };

        // define read function
        _readfunc = function (successful, failed) {
            if (_isScanning) {
                setTimeout(function () {
                    failed(new Error('In use by another task.'));
                }, 0);
                return;
            }
            _isScanning = true;
            _ndef = new window.NDEFReader();
            _scanController = new AbortController();
            _scanController.signal.onabort = function () {
                callbackFailed(failed, new Error('Aborted reading NFC tag.'));
            };
            _readingErrorListener = function () {
                callbackFailed(failed, new Error('Cannot read data from the NFC tag.'));
            };
            _readingListener = function (event) {
                console.log(event);
                if (_isScanning) {
                    _isScanning = false;
                    finallyScan();
                    successful({ serialNumber: event.serialNumber, message: event.message });
                }
            };
            _ndef.addEventListener('readingerror', _readingErrorListener);
            _ndef.addEventListener('reading', _readingListener);
            _ndef.scan({ signal: _scanController.signal }).catch(function (error) {
                callbackFailed(failed, error);
            });
        };

        // define write function
        _writefunc = function (message, options, successful, failed) {
            if (_isScanning) {
                setTimeout(function () {
                    failed(new Error('In use by another task.'));
                }, 0);
                return;
            }
            var overwrite = options.overwrite || false;
            _isScanning = true;
            _ndef = new window.NDEFReader();
            _scanController = new AbortController();
            _scanController.signal.onabort = function () {
                callbackFailed(failed, new Error('Aborted writing NFC tag.'));
            };
            _readingErrorListener = function () {
                callbackFailed(failed, new Error('Cannot write data to the NFC tag.'));
            };
            _readingListener = function (event) {
                console.log(event);
            };
            _ndef.addEventListener('readingerror', _readingErrorListener);
            _ndef.addEventListener('reading', _readingListener);
            if (message === null) {
                message = { records: [{ recordType: 'empty' }] };
            }
            _ndef
                .write(message, { overwrite: overwrite, signal: _scanController.signal })
                .then(function () {
                    if (_isScanning) {
                        _isScanning = false;
                        finallyScan();
                        successful();
                    }
                })
                .catch(function (error) {
                    callbackFailed(failed, error);
                });
        };
    } else {
        _readfunc = function (successful, failed) {
            setTimeout(function () {
                failed(new Error('Web NFC is not supported.'));
            }, 0);
        };
        _writefunc = function (message, options, successful, failed) {
            setTimeout(function () {
                failed(new Error('Web NFC is not supported.'));
            }, 0);
        };
    }

    var webnfc = {
        /**
         * Check if Web NFC is supported
         * @returns true if Web NFC is supported
         */
        isSupported: function () {
            return _isSupported;
        },
        /**
         * Start read NFC Tag.
         * @param {function} successful Function called on success
         * @param {function} failed Function called on failure
         */
        read: _readfunc,
        /**
         * Start write NFC Tag.
         * @param {function} message Message to write
         * @param {function} options Write options
         * @param {function} successful Function called on success
         * @param {function} failed Function called on failure
         */
        write: _writefunc,
        /**
         * Check if NFC tag is being scanned
         * @returns true if NFC tag is being scanned
         */
        isScanning: function () {
            return _isScanning;
        },
        /**
         * Abort scanning NFC tag
         */
        abort: function () {
            if (_isScanning) {
                if (_scanController) {
                    _scanController.abort();
                }
            }
        },
    };
    window.WebNFC = webnfc;
})(window);

function DataViewToString(dataview, isutf8) {
    var resultStr = '';
    var datalen = dataview ? dataview.byteLength : 0;
    for (var i = 0; i < datalen; i++) {
        var d = dataview.getUint8(i);
        resultStr += '%' + ('0' + d.toString(16)).slice(-2);
    }
    resultStr = resultStr.toUpperCase();
    if (isutf8) {
        var decodedStr = decodeURIComponent(resultStr);
        resultStr = resultStr.replaceAll('%', ' ');
        resultStr = decodedStr + ' [' + resultStr + ' ]';
    } else {
        resultStr = resultStr.replaceAll('%', ' ');
        resultStr = '[' + resultStr + ' ]';
    }
    return resultStr;
}

var WebNFC = WebNFC || {};

window.addEventListener('DOMContentLoaded', function () {
    document.getElementById('checksupport').addEventListener('click', function () {
        var resultHtml = '';
        if (WebNFC.isSupported()) {
            resultHtml = '- Web NFC is <strong>supported</strong>.';
        } else {
            resultHtml = '- Web NFC is not supported.';
        }
        document.getElementById('checksupport_result').innerHTML = resultHtml;
    });

    var cancelScanFunc = null;

    document.getElementById('scan').addEventListener('click', function () {
        document.getElementById('scan_status').innerHTML = ' - Scanning...';
        document.getElementById('scan_result').innerText = '';
        WebNFC.read(
            function (data) {
                var records = data.message.records;
                var recordsLen = records.length;
                var resultText = '';
                resultText += 'serialNumber:\n' + data.serialNumber + '\n\n';
                resultText += 'message: - ';
                resultText += recordsLen === 1 ? '1 record' : recordsLen + ' records';
                resultText += ' exists\n';
                for (var i = 0; i < recordsLen; i++) {
                    var r = records[i];
                    var isutf8 = r.encoding && r.encoding.toLowerCase() === 'utf-8';
                    resultText += '[' + i + ']\n';
                    resultText += '  recordType : ' + r.recordType + '\n';
                    if (r.encoding) {
                        resultText += '  encoding : ' + r.encoding + '\n';
                    }
                    resultText += '  data : ' + DataViewToString(r.data, isutf8) + '\n';
                }
                document.getElementById('scan_status').innerHTML = ' - Scan successful';
                document.getElementById('scan_result').innerText = resultText;
                document.getElementById('cancelscan').disabled = true;
                if (cancelScanFunc) {
                    document.getElementById('cancelscan').removeEventListener('click', cancelScanFunc);
                    cancelScanFunc = null;
                }
            },
            function (error) {
                document.getElementById('scan_status').innerHTML = ' - Scan failed';
                document.getElementById('scan_result').innerText = error.message;
                document.getElementById('cancelscan').disabled = true;
                if (cancelScanFunc) {
                    document.getElementById('cancelscan').removeEventListener('click', cancelScanFunc);
                    cancelScanFunc = null;
                }
            }
        );
        document.getElementById('cancelscan').disabled = false;
        cancelScanFunc = function () {
            WebNFC.abort();
            document.getElementById('cancelscan').removeEventListener('click', cancelScanFunc);
            cancelScanFunc = null;
        };
        document.getElementById('cancelscan').addEventListener('click', cancelScanFunc);
    });

    document.getElementById('write').addEventListener('click', function () {
        document.getElementById('write_status').innerHTML = ' - Scanning...';
        document.getElementById('write_result').innerText = '';
        WebNFC.write(
            document.getElementById('write_message').value || null,
            { overwrite: !!document.getElementById('write_overwrite').checked },
            function () {
                document.getElementById('write_status').innerHTML = ' - Write successful';
                document.getElementById('write_result').innerText = '';
                document.getElementById('cancelwrite').disabled = true;
                if (cancelScanFunc) {
                    document.getElementById('cancelwrite').removeEventListener('click', cancelScanFunc);
                    cancelScanFunc = null;
                }
            },
            function (error) {
                document.getElementById('write_status').innerHTML = ' - Write failed';
                document.getElementById('write_result').innerText = error.message;
                document.getElementById('cancelwrite').disabled = true;
                if (cancelScanFunc) {
                    document.getElementById('cancelwrite').removeEventListener('click', cancelScanFunc);
                    cancelScanFunc = null;
                }
            }
        );
        document.getElementById('cancelwrite').disabled = false;
        cancelScanFunc = function () {
            WebNFC.abort();
            document.getElementById('cancelwrite').removeEventListener('click', cancelScanFunc);
            cancelScanFunc = null;
        };
        document.getElementById('cancelwrite').addEventListener('click', cancelScanFunc);
    });
});

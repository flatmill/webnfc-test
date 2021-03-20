(function (window) {
    'use struct';

    /** true if NDEFReader is active. */
    var _isActive = false;

    /** Controller for abort scan/write. */
    var _scanController = null;

    /**
     * Check if Web NFC is supported
     * @returns true if Web NFC is supported
     */
    function isSupported() {
        return 'NDEFReader' in window;
    }

    /**
     * Start scan NFC Tag.
     * @param {function} successful Function called on success
     * @param {function} failed Function called on failure
     */
    function scan(successful, failed) {
        if (_isActive) {
            setTimeout(function () {
                failed(new Error('In use by another task.'));
            }, 0);
            return;
        }
        _isActive = true;
        if (!isSupported()) {
            setTimeout(function () {
                _scanFailed(failed, new Error('Web NFC is not supported.'));
            }, 0);
            return;
        }
        _scanController = new AbortController();
        _scanController.signal.onabort = function () {
            _scanFailed(failed, new Error('Aborted.'));
        };
        var ndef = new window.NDEFReader();
        ndef.addEventListener('readingerror', function () {
            _scanFailed(failed, new Error('Cannot read data from the NFC tag.'));
        });
        ndef.addEventListener('reading', function (event) {
            console.log(event);
            _scanSuccessful(successful, event.serialNumber, event.message);
        });
        ndef.scan({ signal: _scanController.signal }).catch(function (error) {
            _scanFailed(failed, error);
        });
    }

    function _scanFailed(failed, error) {
        if (_isActive) {
            _isActive = false;
            _scanController = null;
            failed(error);
        }
    }

    function _scanSuccessful(successful, serialNumber, message) {
        if (_isActive) {
            _isActive = false;
            _scanController = null;
            successful({ serialNumber: serialNumber, message: message });
        }
    }

    function write(validate, successful, failed) {
        if (_isActive) {
            setTimeout(function () {
                failed(new Error('In use by another task.'));
            }, 0);
            return;
        }
        _isActive = true;
        if (!isSupported()) {
            setTimeout(function () {
                _writeFailed(failed, new Error('Web NFC is not supported.'));
            }, 0);
            return;
        }
        _scanController = new AbortController();
        _scanController.signal.onabort = function () {
            _writeFailed(failed, new Error('Aborted.'));
        };
        var ndef = new window.NDEFReader();
        ndef.addEventListener('readingerror', function () {
            _writeFailed(failed, new Error('Cannot read data from the NFC tag.'));
        });
        ndef.addEventListener('reading', function (event) {
            var result = validate(event.serialNumber, event.message);
            if (!result) {
                _writeFailed(failed, new Error('Cannot read data from the NFC tag.'));
            } else {
                var message = result.message || null;
                var overwrite = !!(result.overwrite || false);
                _scanController = new AbortController();
                _scanController.signal.onabort = function () {
                    _writeFailed(failed, new Error('Aborted.'));
                };
                ndef.write(message, { overwrite: overwrite, signal: _scanController.signal })
                    .then(function () {
                        _writeSuccessful(successful);
                    })
                    .catch(function (error) {
                        _writeFailed(failed, error);
                    });
            }
        });
        ndef.scan({ signal: _scanController.signal }).catch(function (error) {
            _writeFailed(failed, error);
        });
    }

    function _writeFailed(failed, error) {
        if (_isActive) {
            _isActive = false;
            _scanController = null;
            failed(error);
        }
    }

    function _writeSuccessful(successful) {
        if (_isActive) {
            _isActive = false;
            _scanController = null;
            successful();
        }
    }

    /**
     * Check if NFC tag is being scanned
     * @returns true if NFC tag is being scanned
     */
    function isScanning() {
        return !!_isActive;
    }

    /**
     * Abort scanning NFC tag
     */
    function abort() {
        if (_isActive) {
            if (_scanController) {
                _scanController.abort();
            }
        }
    }

    window.WebNFC = {
        isSupported: isSupported,
        scan: scan,
        write: write,
        isScanning: isScanning,
        abort: abort,
    };
})(window);

function DataViewToString(dataview, isutf8) {
    var resultStr = '';
    var datalen = dataview.byteLength;
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
        WebNFC.scan(
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
            function () {
                return {
                    message: document.getElementById('write_message').value,
                    overwrite: !!document.getElementById('write_overwrite').checked,
                };
            },
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

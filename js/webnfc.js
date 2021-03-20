(function (window) {
    var _isScanning = false;
    var _scanController = null;

    /**
     * Check if Web NFC is supported
     * @returns true if Web NFC is supported
     */
    function isSupported() {
        return 'NDEFReader' in window;
    }

    /**
     * Start scan NFC Tag
     * @param {function} successful Function called on success
     * @param {function} failed Function called on failure
     */
    function scan(successful, failed) {
        if (_isScanning) {
            return;
        }
        _isScanning = true;
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

    /**
     * Check if NFC tag is being scanned
     * @returns true if NFC tag is being scanned
     */
    function isScanning() {
        return !!_isScanning;
    }

    /**
     * Abort scanning NFC tag
     */
    function abort() {
        if (_isScanning) {
            if (_scanController) {
                _scanController.abort();
            }
        }
    }

    function _scanFailed(failed, error) {
        if (_isScanning) {
            _isScanning = false;
            _scanController = null;
            failed(error);
        }
    }

    function _scanSuccessful(successful, serialNumber, message) {
        if (_isScanning) {
            _isScanning = false;
            _scanController = null;
            successful({ serialNumber: serialNumber, message: message });
        }
    }

    window.WebNFC = {
        isSupported: isSupported,
        scan: scan,
        isScanning: isScanning,
        abort: abort,
    };
})(window);

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
                document.getElementById('scan_status').innerHTML = ' - Scan successful';
                document.getElementById('scan_result').innerText =
                    'serialNumber:\n' + data.serialNumber + '\n\nmessage:\n' + JSON.stringify(data.message, null, '  ');
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
});

const json = {
            "algorithm":  "machine_control_js",
            "camera": '102022222',
            "start_tracking": 'date',
            "stop_tracking": 'date',
            "photos": [],
            "violation_found": true,
            "extra": {}
        }
        const body = JSON.stringify(json, null, 2)

fetch('http://django-service:8000/api/reports/report-with-photos/', {
            method: "POST",
            headers: { 'Content-Type': 'application/json;charset=utf-8' },
            body
        })
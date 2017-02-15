from bottle import get, post, route, error, request, run, static_file

import json, time, os, subprocess, sqlite3

status = { 'state':'off', 'rate': 0 }
process = None;
projectRoot = "~/Projects/Thesis/" if os.path.isdir("~/Projects/Thesis") else "../" 
webRoot = projectRoot + "Interface/"

# =================== Actions ===================

# for testing purposes
@get('/shutdown')
def shutdown():
	status['state'] = "off"
	return ""


@get('/status')
def getStatus():
	return json.dumps(status)

@post('/init')
def boot():

	process = subprocess.Popen(
			[
				"java",
				"-Dhttp.proxyHost=icache",
				"-Dhttp.proxyPort=80", "-jar",
				projectRoot + "Core/target/thesis-0.1.jar"
			],
			stdin=subprocess.PIPE
		)

    # This boots quickly for now, skip waiting for boot phase
	if ( process.poll() is None ):
		status['state'] = "idle"

	process.stdin.close()

	return json.dumps(status)


# ================ Static Pages =================

@route('/')
def static_html():
	return static_file("index.html", root = webRoot )

@route('/css/index.css')
def static_css():
	return static_file("index.css", root = webRoot + 'css')

@route('/js/jquery.js')
def static_jquery():
	return static_file("jquery-3.1.1.min.js", root = webRoot + 'js')

@route('/js/index.js')
def static_js():
	return static_file("index.js", root = webRoot + 'js')

@error(404)
def error404(error):
    return "Error 404: This page or url was not found."

# ===============================================

run(host='localhost', port=8080, debug=True, reloader=True)
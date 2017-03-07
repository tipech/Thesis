from bottle import get, post, route, error, request, run, static_file

import json, time, os, subprocess, sqlite3

status = { 'state':'off', 'rate': 0 }
process = None;
projectRoot = "~/Projects/Thesis/" if os.path.isdir("~/Projects/Thesis") else "../" 
webRoot = projectRoot + "interface/"

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

	global process
	process = subprocess.Popen(
			[
				"java",
				"-Dhttp.proxyHost=icache",
				"-Dhttp.proxyPort=80", "-jar",
				projectRoot + "core/target/wrapper-jar-with-dependencies.jar"
			],
			stdin=subprocess.PIPE
			# stdout=subprocess.PIPE
		)

    # This boots quickly for now, skip waiting for boot phase
	if ( process.poll() is None ):
		status['state'] = "idle"

	return json.dumps(status)


@post('/start')
def start():

	dataJson = request.body.read()

	global process

	process.stdin.write('{ "command": "start", "data": ' + dataJson + "}\n")
	# process.stdin.write('{ "command": "quit"}\n')


	return json.dumps(status)


# ================ Static Pages =================

@route('/')
def static_html():
	return static_file("index.html", root = webRoot )

@route('/css/index.css')
def static_css():
	return static_file("index.css", root = webRoot + 'css')

@route('/favicon.ico')
def static_css():
	return static_file("favicon.png", root = webRoot )

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
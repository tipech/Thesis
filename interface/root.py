import json, time, os, subprocess, sqlite3
from bottle import get, post, route, error, request, run, static_file
from threading  import Thread
from Queue import Queue, Empty


status = { 'state':'off', 'settings':{}}
process = None;
projectRoot = "~/Projects/Thesis/" if os.path.isdir("~/Projects/Thesis") else "../" 
webRoot = projectRoot + "interface/"
dbConnection = sqlite3.connect(webRoot + "data.db")

windowPortion = 0.1 # portion of the time window representing "latest" data

# ===================== API =====================

# for testing purposes
@get('/shutdown')
def shutdown():
	status['state'] = "off"
	return ""

@post('/boot')
def boot():

	if(status['state'] == "off"):
		global process
		global processQueue
		process = subprocess.Popen(
				[
					"java",
					"-Dhttp.proxyHost=icache",
					"-Dhttp.proxyPort=80",
					"-jar",
					projectRoot + "core/target/wrapper-jar-with-dependencies.jar"
				],
				stdin=subprocess.PIPE,
				# stdout=subprocess.PIPE, # uncomment to suppress java (core) process stdout
				stderr=subprocess.PIPE,
				bufsize=1
			)
		processQueue = Queue()
		processThread = Thread(target=enqueue_output, args=(process.stderr, processQueue))
		processThread.daemon = True # thread dies with the program
		processThread.start()

		if ( process.poll() is None ):
			status['state'] = "idle"

	return json.dumps(status)


@post('/start')
def start():

	dataJson = request.body.read()

	if(status['state'] == "idle"):
		global process

		process.stdin.write('{ "command": "start", "data": ' + dataJson + "}\n")

		# TODO check response

		status['state'] = "prepare"
		status['settings'] = json.loads(dataJson)['settings']

	return json.dumps(status)


@get('/status')
def getStatus():
	
	if(status['state'] != "off"):

		processStatus = checkStatus()

		if(processStatus == "setup" or processStatus == "live"):
			status['state'] = processStatus

		elif(processStatus == "stop" or processStatus == "error"):
			# if java (core) process was terminated or can't be contacted
			status['state'] = "off"

	return json.dumps(status)


@get('/init')
def initializeData():

	return json.dumps({
			'groups':selectAll("groups"),
			'newsItems':selectNewsItemsWithGroups(),
			'feedsCount':selectFeedsCount(),
			'statuses':selectAll("status"),
			'settings': status['settings']
		})


@get('/data')
def getLiveData():

	processStatus = checkStatus()

	if(processStatus == "stop" or processStatus == "error"):
		# if java (core) process was terminated or can't be contacted
		status['state'] = "off"
		return '{"error":"Core process offline."}'
	else:

		data = {"statuses": selectStatusesInWindow(str(status['settings']['windowPeriod']*windowPortion)) }


		#fetch and retrieve data from database
		return json.dumps(data)

# =========== Database Access Methods ===========

def selectNewsItemsWithGroups():

	cursor = dbConnection.cursor()
	cursor.execute("SELECT news.id, news.title, group_concat(groups.color) FROM newsGroups"
		+ " LEFT OUTER JOIN news ON newsGroups.newsItemId = news.id"
		+ " LEFT OUTER JOIN groups ON newsgroups.groupId = groups.id GROUP BY news.id")
	result = cursor.fetchall()
	cursor.close()

	return result

def selectStatusesInWindow(window):

	cursor = dbConnection.cursor()
	cursor.execute("SELECT * FROM status WHERE time > (SELECT time FROM status ORDER BY time DESC LIMIT 1) - "+ window)
	result = cursor.fetchall()
	cursor.close()

	return result

def selectFeedsCount():
	
	cursor = dbConnection.cursor()
	cursor.execute("SELECT count(*) FROM feeds")
	result = cursor.fetchone()
	cursor.close()

	print result[0]

	return result[0]

def selectAll( table ):
	
	cursor = dbConnection.cursor()
	cursor.execute("SELECT * FROM " + table)
	result = cursor.fetchall()
	cursor.close()

	return result


# ================ Helper Methods ===============

# Check the status of the java (core) process
def checkStatus():

	global process
	global processQueue

	try:

		processStatus = False

		# read all replies
		responses = exhaust_queue(processQueue)
		# hold on to the last status reply (if exists)
		for line in responses.split("\n") or []:
			if(line.rstrip() == "STATUS_START"):
				processStatus = "start"
			elif(line.rstrip() == "STATUS_SETUP"):
				processStatus = "setup"
			elif(line.rstrip() == "STATUS_LIVE"):
				processStatus = "live"
			elif(line.rstrip() == "STATUS_STOP"):
				processStatus = "stop"
			else:
				print line

		return processStatus

	except IOError:
		return "error"


def enqueue_output(out, queue):
	for line in iter(out.readline, b''):
		queue.put(line)
	out.close()

def exhaust_queue(processQueue):
	try:  line = processQueue.get_nowait() 
	except Empty:
		return ""
	else: 
		return line.rstrip() + "\n" + exhaust_queue(processQueue)

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

@route('/js/d3.js')
def static_d3():
	return static_file("d3.min.js", root = webRoot + 'js')

@route('/js/index.js')
def static_js():
	return static_file("index.js", root = webRoot + 'js')

@error(404)
def error404(error):
    return "Error 404: This page or url was not found."

# ===============================================

# Test route
@get('/test')
def test():
	cursor = dbConnection.cursor()
	cursor.execute("SELECT count(*) FROM feeds")
	result = cursor.fetchone()
	cursor.close()

	print result[0]




	return ""

run(host='localhost', port=8080, debug=True, reloader=True)
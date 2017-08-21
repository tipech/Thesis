import json, time, os, subprocess, sqlite3
from bottle import get, post, route, error, request, run, static_file
from threading  import Thread
from Queue import Queue, Empty


status = { 'state':'off'}
process = None;
projectRoot = "~/Projects/Thesis/" if os.path.isdir("~/Projects/Thesis") else "../" 
webRoot = projectRoot + "interface/"
dbConnection = sqlite3.connect(webRoot + "data.db")

windowPortion = 0.2 # portion of the time window representing "latest" data

# ===================== API =====================

# for testing purposes
@get('/shutdown')
def shutdown():
	status['state'] = "off"
	return ""

@post('/ready')
def ready():

	status['error'] = None
	if 'settings' in status:
		status['state'] = "done"
		return json.dumps(status)
	else:
		status['error'] = "No previous data!"
		return status

@post('/boot')
def boot():

	status['error'] = None
	if(status['state'] == "off" or status['state'] == "done" ):
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

	status['error'] = None
	dataJson = request.body.read()

	if(status['state'] == "idle"):
		global process

		process.stdin.write('{ "command": "start", "data": ' + dataJson + '}\n')

		# TODO check response

		status['state'] = "prepare"
		status['settings'] = json.loads(dataJson)['settings']

	return json.dumps(status)


@get('/status')
def getStatus():
	
	status['error'] = None
	if(status['state'] != "off" and status['state'] != "done"):

		processStatus = checkStatus()

		if(processStatus == "setup" or processStatus == "live"):
			status['state'] = processStatus

		elif(processStatus == "stop" or processStatus == "error"):
			# if java (core) process was terminated or can't be contacted
			status['state'] = "off"

	return json.dumps(status)


@get('/init')
def getInitialData():

	status['error'] = None
	return json.dumps({
			'statuses':selectAll("status"),
			'groups':selectGroupsWithData(),
			'newsItems':selectNewsItemsWithData(),
			'feedsCount':selectFeedsCount(),
			'settings': status['settings']
		})


@get('/data')
def getLiveData():

	status['error'] = None
	processStatus = checkStatus()

	if(processStatus == "stop" or processStatus == "error"):
		# if java (core) process was terminated or can't be contacted
		status['state'] = "off"
		return '{"error":"Core process offline."}'

	else:

		data = {
				'status': selectLastStatus(),
				'newsItems':selectLastNewsItemCounts(),
				'groups':selectLastGroupCounts()
			}


		#fetch and retrieve data from database
		return json.dumps(data)


@post('/stop')
def stop():

	status['error'] = None
	if(status['state'] == "live"):
		global process

		process.stdin.write('{ "command": "stop" }\n')
		process.kill()

		status['state'] = "done"

	return json.dumps(status)

# =========== Database Access Methods ===========

def selectAll( table ):
	
	cursor = dbConnection.cursor()
	cursor.execute("SELECT * FROM " + table)
	result = cursor.fetchall()
	cursor.close()

	return result


def selectFeedsCount():
	
	cursor = dbConnection.cursor()
	cursor.execute("SELECT count(*) FROM feeds")
	result = cursor.fetchone()
	cursor.close()

	return result[0]


def selectNewsItemsWithData():

	# Hold on to your butts for a pretty big multi-select:
	#
	# A) We want to retrieve the basic news item information, mainly the title:
	#	1. We select (among other things) the news id and title
	#
	# B) News items and groups have an M-N relationship, and we want the news item titles and group colors, so:
	#	1. We select the news-groups realtionship table (newsgroups)
	#	2. We join it onto the news items table
	#	3. We join what we have onto the groups table
	#	4. We group them by news item. We also make sure to merge (concat) the group colors together
	#
	# C) Now we want to get the history of tweet matching for every item, split into (status) update periods, so:
	#	1. We join what data we already had with the result of a multi-select subquery, where:
	#	2. We cross join news and statuses, so that we can make a concatenated string
	#	   The string will contain 0 for every status update (e.g. 0,0,0,0,0,0 for 6 periods)
	#	3. We unite that with another select, the one that has the actual tweet-status match data
	#	4. We divide the times with updatePeriod so that all tweet times are rounded to closest status time
	#	   We also subtract half an update period to the tweet time, so that rounding will put it between statuses
	#	5. We group results by both tweet news id and status id, and we can now count the tweets per status period
	#	6. We group results again by news and status id, adding together the 0s from the cross table with actual values
	#	7. We group results by news id only, so we can now concat the values together in a string
	#
	# D) Finally, to merge everything together:
	#	1. We join the two top selects into one, which now contains both news data and tweet counts

	cursor = dbConnection.cursor()
	cursor.execute("SELECT newsData.id, newsData.title, newsData.mergedColor, tweetData.count, tweetData.sentiment FROM "	#A1
		+ " (SELECT news.id AS id, news.title AS title, group_concat(groups.color) AS mergedColor FROM newsGroups" 	#B1
			+ " LEFT OUTER JOIN news ON newsGroups.newsItemId = news.id" 											#B2
			+ " LEFT OUTER JOIN groups ON newsgroups.groupId = groups.id" 											#B3
			+ " GROUP BY news.id) AS newsData" 																		#B4
			+ " LEFT OUTER JOIN (SELECT newsIdTotal AS id,"
			+ " group_concat(tweetCountTotal) AS count, group_concat(tweetSentimentTotal) AS sentiment FROM"
				+ " (SELECT statusId AS statusIdTotal, newsId AS newsIdTotal,"								#C1
				+ " sum(tweetCount) AS tweetCountTotal, sum(tweetSentiment) AS tweetSentimentTotal FROM"	#C1
					+ " (SELECT status.id AS statusId, news.id AS newsId, 0 AS tweetCount, 0 AS tweetSentiment FROM news"	#C2
						+ " CROSS JOIN status"																				#C2
					+ " UNION SELECT status.id AS statusId, tweets.newsId AS newsId,"							#C3
					+ " count(tweets.id) AS tweetCount, sum(tweets.sentiment) AS tweetSentiment FROM status"	#C3
						+ " LEFT OUTER JOIN tweets ON status.time/" + str(status['settings']['updatePeriod']) + " ="	#C4
							+ " (tweets.time - " + str(status['settings']['updatePeriod']) + "/2)/"						#C4
							+ str(status['settings']['updatePeriod'])													#C4
						+ " GROUP BY tweets.newsId, status.id)"					#C5		
					+ " GROUP BY statusId, newsId)"							#C6
				+ " GROUP BY newsIdTotal) AS tweetData"					#C7
			+ " ON newsData.id = tweetData.id")						#D1
	result = cursor.fetchall()
	cursor.close()

	return result


def selectGroupsWithData():

	# Another big multi-select, similar to the previous one, without part #B for group matching and color merging
	# 
	# E) Only difference, we now sum up together the values of every newsfeed for every group
	#	1. We spend an extra grouping step to sum them up

	cursor = dbConnection.cursor()
	cursor.execute("SELECT groupId, groups.name, groups.color, group_concat(tweetCountTotal), group_concat(tweetSentimentTotal) FROM"
		+ " (SELECT statusId, groupId, sum(newsTweetCount) AS tweetCountTotal, sum(newsTweetSentiment) AS tweetSentimentTotal FROM"	#E1
			+ " (SELECT status.id AS statusId, groups.id AS groupId, 0 AS newsTweetCount, 0 AS newsTweetSentiment FROM groups"
				+ " CROSS JOIN status"
			+ " UNION SELECT statusId, newsGroups.groupId AS groupId,"
			+ " sum(tweetCount) AS newsTweetCount, sum(tweetSentiment) AS newsTweetSentiment FROM newsGroups"
				+ " LEFT OUTER JOIN (SELECT status.id AS statusId, tweets.newsId AS newsId,"
				+ " count(tweets.id) AS tweetCount, sum(tweets.sentiment) AS tweetSentiment FROM status"
					+ " LEFT OUTER JOIN tweets ON status.time/" + str(status['settings']['updatePeriod']) + " ="
						+ " (tweets.time - " + str(status['settings']['updatePeriod']) + "/2)/"	
						+ str(status['settings']['updatePeriod'])
					+ " GROUP BY tweets.newsId, status.id)"
				+ " ON newsGroups.newsItemId = newsId"
				+ " GROUP BY statusId, groupId)"
			+ " GROUP BY statusId, groupId)"
		+ " INNER JOIN groups ON groups.id = groupId"
		+ " GROUP BY groupId")
	result = cursor.fetchall()
	cursor.close()

	return result



def selectLastStatus():

	cursor = dbConnection.cursor()
	cursor.execute("SELECT * FROM status ORDER BY status.time DESC LIMIT 1")
	result = cursor.fetchone()
	cursor.close()

	return result


def selectLastNewsItemCounts():

	# Another big select, similar to selectNewsItemsWithData, for only last period and without group data (only part #C)

	cursor = dbConnection.cursor()
	cursor.execute("SELECT newsId, sum(tweetCount), sum(tweetSentiment) FROM"
		+ " (SELECT news.id AS newsId, 0 AS tweetCount, 0 AS tweetSentiment FROM news"
		+ " UNION SELECT tweets.newsId AS newsId, count(tweets.id) AS tweetCount, sum(tweets.sentiment) AS tweetSentiment FROM tweets"
			+ " WHERE (tweets.time - " + str(status['settings']['updatePeriod']) + "/2) /"
				+ str(status['settings']['updatePeriod']) + " ="
				+ " (SELECT status.time FROM status ORDER BY status.time DESC LIMIT 1,1) /" 
					+  str(status['settings']['updatePeriod'])
			+ " GROUP BY newsId)"
		+ " GROUP BY newsId")
	result = cursor.fetchall()
	cursor.close()

	return result


def selectLastGroupCounts():

	# Another big select, similar to selectGroupsWithData, for only last period and without color data (only part #C)

	cursor = dbConnection.cursor()
	cursor.execute("SELECT groupId, sum(newsTweetCount), sum(newsTweetSentiment) FROM"
		+ " (SELECT newsGroups.groupId AS groupId, sum(tweetCount) AS newsTweetCount, sum(tweetSentiment) AS newsTweetSentiment FROM"
			+ " (SELECT news.id AS newsId, 0 AS tweetCount, 0 AS tweetSentiment FROM news"
			+ " UNION SELECT tweets.newsId AS newsId, count(tweets.id) AS tweetCount, sum(tweets.sentiment) AS tweetSentiment FROM tweets"
				+ " WHERE (tweets.time - " + str(status['settings']['updatePeriod']) + "/2) /"
					+ str(status['settings']['updatePeriod']) + " ="
					+ " (SELECT status.time FROM status ORDER BY status.time DESC LIMIT 1,1) /" 
						+  str(status['settings']['updatePeriod'])
				+ " GROUP BY newsId)"
				+ " INNER JOIN newsGroups ON newsGroups.newsItemId = newsId"
			+ " GROUP BY newsId)"
		+ " GROUP BY groupId")
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

@route('/js/helper.js')
def static_js():
	return static_file("helper.js", root = webRoot + 'js')

@route('/js/charts.js')
def static_js():
	return static_file("charts.js", root = webRoot + 'js')

@route('/js/buffers.js')
def static_js():
	return static_file("buffers.js", root = webRoot + 'js')

@error(404)
def error404(error):
    return "Error 404: This page or url was not found."

# ===============================================

# Test route
@get('/test')
def test():
	cursor = dbConnection.cursor()
	cursor.execute( "SELECT * FROM groups")
	result = cursor.fetchall()
	cursor.close()

	print result




	return json.dumps(result)

run(host='0.0.0.0', port=8080, debug=True, reloader=True)

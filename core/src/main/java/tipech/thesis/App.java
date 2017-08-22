package tipech.thesis;

import java.util.List;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Comparator;

import java.util.stream.Stream;
import java.util.stream.Collectors;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.IllegalStateException;
import java.lang.InterruptedException;
import javax.net.ssl.SSLException;
import java.sql.SQLException;

import com.google.gson.JsonParser;
import com.google.gson.JsonObject;

// import org.apache.http.HttpHost;
import com.twitter.hbc.core.Hosts;
import com.twitter.hbc.core.HttpHosts;

import com.twitter.hbc.ClientBuilder;
import com.twitter.hbc.core.Client;
import com.twitter.hbc.core.Constants;
import com.twitter.hbc.core.endpoint.StatusesFilterEndpoint;
import com.twitter.hbc.core.processor.StringDelimitedProcessor;
import com.twitter.hbc.httpclient.auth.Authentication;
import com.twitter.hbc.httpclient.auth.OAuth1;


import tipech.thesis.entities.ControlMessage;
import tipech.thesis.entities.FeedGroup;
import tipech.thesis.entities.Feed;
import tipech.thesis.entities.FeedItem;
import tipech.thesis.entities.NewsItem;
import tipech.thesis.entities.Tweet;

import tipech.thesis.extraction.RSSFeedParser;
import tipech.thesis.extraction.KeywordExtractor;
import tipech.thesis.extraction.StanfordSentimentAnalyzer;
import tipech.thesis.extraction.OpenNLPSentimentAnalyzer;
import tipech.thesis.extraction.JaccardComparator;
import tipech.thesis.extraction.DatabaseManager;


/**
 * 
 *
 */
public class App 
{

	public enum STATE {
		IDLE, KEYWORDS, SETUP, LIVE
	}

	/* =============== General Setup =============== */

	private static STATE state;
	private static int TIMEOUT = 2*60*60; // seconds until process termination

	// ---- Managers ----
	private static BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));
	private static DatabaseManager dbManager;
	private static KeywordExtractor keywordExtractor;
	private static StanfordSentimentAnalyzer stanfordSA;
	private static OpenNLPSentimentAnalyzer openNLPSA;
	private static JaccardComparator comparator = new JaccardComparator();
	private static Client hosebirdClient;

	// ---- Data Lists and counters ----
	private static final List<NewsItem> newsList = new ArrayList<NewsItem>();
	private static List<Feed> feedsList = new ArrayList<Feed>();
	private static List<FeedGroup> groupsList = new ArrayList<FeedGroup>();

	private static String currentFeedUrl;
	private static int groupIndex = 0;
	private static int feedIndex = 0;
	private static int messageCount = 0;

	private static long startTime;
	private static long endTime;
	private static long refreshTime;
	private static int tweetTotal;
	private static int matchTotal;
	private static int limitTotal;
	private static int sentimentTotal;
	private static int lastLimit;
	private static boolean stopLoop = false;

	// ---- Helper objects ----
	private static DateTimeFormatter rssDateFormat = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz");
	private static LocalDate rejectDate = null;

	private static ControlMessage message;

	/* ============================================= */


	/* =============== Twitter Setup =============== */

	// ---- Configuration ----
	private static String consumerKey = "ZAPfZLcBhYEBCeRSAK5PqkTT7";
	private static String consumerSecret = "M81KvgaicyJIaQegdgXcdKDeZrSsJz4AVrGv3yoFwuItQQPMay";
	private static String token = "2591998746-Mx8ZHsXJHzIxAaD2IxYfmzYuL3pYNVnvWoHZgR5";
	private static String secret = "LJDvEa0jL7QJXxql0NVrULTAniLobe2TAAlnBdXRfm1xF";

	// ---- Initialization ----
	private static BlockingQueue<String> msgQueue = new LinkedBlockingQueue<String>(100000);
	//private static  BlockingQueue<Event> eventQueue = new LinkedBlockingQueue<Event>(1000);

	private static StatusesFilterEndpoint hosebirdEndpoint = new StatusesFilterEndpoint();
	private static Authentication hosebirdAuth = new OAuth1(consumerKey, consumerSecret, token, secret);

	/* ============================================= */


	public static void main( String[] args )
	{
		try {
			if(args.length>0){
				keywordExtractor = new KeywordExtractor("debug"); // correct model location when running manually
				openNLPSA = new OpenNLPSentimentAnalyzer(args[0]);

			} else {
				keywordExtractor =  new KeywordExtractor("stanford");
				openNLPSA = new OpenNLPSentimentAnalyzer("default");
			}

			dbManager = new DatabaseManager();
			stanfordSA = new StanfordSentimentAnalyzer();

			endTime = System.currentTimeMillis() + TIMEOUT*1000; // Timeout after 20 seconds

			state = STATE.IDLE;
			

			// ================= Main Loop ================
			while ( System.currentTimeMillis() < endTime && !stopLoop ) {

				switch (state){

					// ------------ Idle State ------------
					case IDLE:
						message = new ControlMessage(bufferedReader, ControlMessage.BLOCKING);

						// Wait for start command
						if( message.getCommand().equals("start") ){

							System.out.println("Start command received, extracting news items and keywords from RSS feeds...");
							// message server process we started
							System.err.println("STATUS_START");

							start();							
							state = STATE.KEYWORDS;
						}

						break;

					// ----- Keyword Extraction State -----
					case KEYWORDS:

						try{
						
							processSingleFeed();
						
						} catch(SSLException e){
							System.out.println("RSS over https connection not supported!");
						
						} catch(Exception e){
							System.out.println(e);
						}

						if( !nextFeed() ){
							System.out.println("Extraction done, setting up database...");
							System.err.println("STATUS_SETUP");
							state = STATE.SETUP;
						}
						
						break;

					// -- Database & Stream Setup State ---
					case SETUP:

						setupDatabase();
						setupStream();

						tweetTotal = 0; matchTotal = 0; limitTotal = 0; sentimentTotal = 0;
						startTime = System.currentTimeMillis();
						refreshTime = startTime;

						dbManager.saveStatus(0, 0, 0, 0, startTime/1000);

						System.out.println("Setup done, starting live stream...");
						System.err.println("STATUS_LIVE");
						state = STATE.LIVE;
						break;

					// ------- Live Streaming State -------
					case LIVE:

						processSingleTweet();

						// Every *updatePeriod* seconds (default: 10), insert measurements into database
						if( System.currentTimeMillis() > refreshTime + message.getUpdatePeriod()*1000 ){ 

							// Save status
							dbManager.saveStatus(tweetTotal, matchTotal, limitTotal, sentimentTotal, System.currentTimeMillis()/1000);
							refreshTime += message.getUpdatePeriod()*1000;
							tweetTotal = 0; matchTotal = 0; limitTotal = 0; sentimentTotal = 0;

							// Check for input
							ControlMessage newMessage = new ControlMessage(bufferedReader, ControlMessage.NONBLOCKING);
							
							if( !newMessage.isEmpty() ){
								// if told to stop
								if( newMessage.getCommand().equals("stop") ){
									
									hosebirdClient.stop();
									System.err.println("STATUS_STOP");
									System.out.println("Stop command received, stopping...");
									state = STATE.IDLE;
								
								// if asked for status
								} else if(newMessage.getCommand().equals("status")){
									// message server process we are running normally
									System.err.println("STATUS_LIVE");
								}
							}
						}						
						break;
				}
			}



		// ==== Termination & Error Handling ====

		} catch (IOException e) {
			e.printStackTrace();
		} catch (IllegalStateException e) {
			e.printStackTrace();
		} catch(InterruptedException e){
			e.printStackTrace();
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try {
				dbManager.close();
				hosebirdClient.stop();
				bufferedReader.close();

				System.err.println("STATUS_STOP");

			} catch (IOException e) {
				e.printStackTrace();
			} catch (NullPointerException e) {
				e.printStackTrace();
			} catch (SQLException e) {
				e.printStackTrace();
			}
		}
	}

	private static void start() {

		groupsList = message.getGroups();
		feedsList.clear();
		newsList.clear();

		groupIndex = 0;
		feedIndex = 0;
	}

	private static void processSingleFeed() throws SSLException, Exception {

		// Get final copies of variables for reading inside the streams
		final LocalDate filterDate = message.getRejectDate();

		// Fetch a single feed from a single group
		currentFeedUrl = groupsList.get(groupIndex).getFeedUrls().get(feedIndex);
		System.out.println("Fetching RSS and extracting keywords from: "+ currentFeedUrl);

		// RSS fetching
		RSSFeedParser parser = new RSSFeedParser(currentFeedUrl);
		Feed feed = parser.readFeed();
		feed.setGroup(groupsList.get(groupIndex));
		feedsList.add(feed);
		List<FeedItem> feedItems = feed.getEntries();
		List<NewsItem> newNewsItems = feedItems.stream()
			// Filter out too old
			.filter( headline -> {
				try{
					return LocalDate.parse(
							headline.getPubDate().replace("EDT","GMT").replaceAll("\\+\\d\\d\\d\\d","GMT"),
							rssDateFormat)
						.isAfter(filterDate);
				} catch (Exception e) {
					System.out.println(e);
					return false;
				}
			})
			// Turn remaining headlines into news items, keep description to 200 chars max
			.map( headline -> 
				new NewsItem(headline.getTitle()
					+ " |&| "
					+ headline.getDescription().substring(0, Math.min(headline.getDescription().length(), 200)), feed) 
			)
			// Extract Keywords
			.peek( newsItem -> newsItem.extractTerms(keywordExtractor))
			// Filter out too small
			.filter( newsItem ->
				// Aggregate counts and compare sum
				newsItem.getTerms().entrySet().stream()
					.reduce(
						0,
						(sum, word) -> sum + word.getValue(),
						(sum1, sum2) -> sum1 + sum2
					) > 2
			)
			// Compare with news from previous feeds and merge if necessary
			.filter( newsItem -> 

				newsList.stream()
					// Look through older news items
					.filter( oldNewsItem -> {
						if(newsItem.compare(oldNewsItem) > message.getNewsThreshold()){
							// merge with old NewsItem
							oldNewsItem.addFeed(feed);
							// if the headlines aren't exactly the same, merge them
							if(!oldNewsItem.getTitle().equals(newsItem.getTitle())){

								oldNewsItem.setTitle(oldNewsItem.getTitle() + " |&| " + newsItem.getTitle());
							}							
							return true; // discard new newsItem
						} else {
							return false;
						}
					} )
					// Stream should only contain stuff if there were common items
					.count() == 0 // allow only unique news
			)
			// Set newsItem ids now that everything's filtered
			.peek(NewsItem::setId)
			.collect(Collectors.toList());

		newsList.addAll( newNewsItems );
	}

	private static boolean nextFeed(){

		// Move on to the next feed/group
		if (feedIndex < groupsList.get(groupIndex).getFeedUrls().size()-1){

			feedIndex++;
			return true;

		} else if (groupIndex < groupsList.size()-1){

			groupIndex++;
			feedIndex = 0;
			return true;

		} else {
			// Keyword extraction done
			return false;			
		}
	}

	private static void setupDatabase() throws SQLException {
		
		// Store the feed groups
		System.out.println("Storing feed groups...");				
		dbManager.saveFeedGroups( groupsList );

		// Store the feeds
		System.out.println("Storing feeds...");	
		dbManager.saveFeeds( feedsList );

		// Store the news items
		System.out.println("Storing news items...");	
		dbManager.saveNews( newsList );

		// Prepare the statuses table
		System.out.println("Preparing status table...");	
		dbManager.setupStatus();

		// Prepare the news tweet entries
		System.out.println("Preparing news tweet entry table...");	
		dbManager.setupTweets();
	}

	private static void setupStream() throws InterruptedException {

		System.out.println("Calculating twitter search terms...");

		// Aggregate the keyword list
		Map<String, Integer> aggregatedTerms = newsList.stream()
			.flatMap( newsItem -> newsItem.getTerms().entrySet().stream() )
			.collect(Collectors.toMap(
				Entry::getKey, 
				Entry::getValue,  
				(count1, count2) -> count1 + count2 // if same words, add counts
			));

		// Filter too small, sort and take the top terms
		List<String> finalKeywords = aggregatedTerms.entrySet().stream()
			.filter(term -> term.getKey().length() > 3 )
			.sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
			.limit(message.getKeywordsCount())
			.map(Map.Entry::getKey)
			.map(String::toLowerCase)
			.collect(Collectors.toList());

		System.out.println(finalKeywords);

		hosebirdEndpoint.trackTerms(finalKeywords);
		hosebirdEndpoint.languages( Arrays.asList("en", "gr") ); 

		if(finalKeywords.size() == 0){
			System.err.println("STATUS_STOP");
			System.exit(0);
		}

		// Final setup
		hosebirdClient = new ClientBuilder()
			.name("Hosebird-Client-01") 			// optional: mainly for logging
			.hosts(Constants.STREAM_HOST)
			.authentication(hosebirdAuth)
			.endpoint(hosebirdEndpoint)
			.processor(new StringDelimitedProcessor(msgQueue))
			// .proxy("icache.intranet.gr", 80)		// only used behind a proxy
			// .eventMessageQueue(eventQueue)		// optional: to process client events
			.build();


		// Showtime
		hosebirdClient.connect();

		// Retrieve a single random tweet, so that we can calculate the time difference between computer and Twitter
		JsonObject jsonTweet = new JsonParser().parse( msgQueue.take() ).getAsJsonObject();
		final Tweet tweet = new Tweet(jsonTweet); 
		dbManager.setTimeOffset( (tweet.getTime() - System.currentTimeMillis())/1000 );
	}

	private static void processSingleTweet() throws InterruptedException{

		JsonObject jsonTweet = new JsonParser().parse( msgQueue.take() ).getAsJsonObject();

		if(jsonTweet.has("limit")){

			limitTotal = jsonTweet.get("limit").getAsJsonObject().get("track").getAsInt() - lastLimit + limitTotal;
			lastLimit = jsonTweet.get("limit").getAsJsonObject().get("track").getAsInt();

		} else {

			final Tweet tweet = new Tweet(jsonTweet);
			tweetTotal++;

			newsList.stream()
				.filter( newsItem -> 
					comparator.similarity(tweet.getWords(), newsItem.getKeywords(), true, true) > message.getTweetThreshold()
				)
				.forEach( newsItem -> {
					try{

						int sentiment = 2;

						if(message.getSentimentAnalyzer() == 0){

							sentiment = (int)Math.round( 
								(stanfordSA.findSentiment(tweet.getCleanText()) + openNLPSA.findSentiment(tweet.getCleanText()) ) / 2 );
						
						} else if(message.getSentimentAnalyzer() == 1){
								
							sentiment = (int)stanfordSA.findSentiment(tweet.getCleanText());

						} else {

							sentiment = (int)openNLPSA.findSentiment(tweet.getCleanText());
						}						

						dbManager.saveTweetEntry(newsItem.getId(), tweet.getTime()/1000, sentiment);
						matchTotal++;
						sentimentTotal+=sentiment;

						System.out.println("\nMatch! News: " + newsItem.getTitle()
							+ "\n Tweet: " + tweet.getCleanText()
							+ "\n Sentiment: " + sentiment );
					
					} catch (SQLException e) {
						e.printStackTrace();
					}
				});
		}
	}
}
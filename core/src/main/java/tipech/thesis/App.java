package tipech.thesis;

import java.util.List;
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

import tipech.thesis.extraction.RSSFeedParser;
import tipech.thesis.extraction.KeywordExtractor;
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
	private static int TIMEOUT = 20; // seconds

	// ---- Managers ----
	private static BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));
	private static DatabaseManager dbManager;
	private static KeywordExtractor keywordExtractor = new KeywordExtractor();
	private static Client hosebirdClient;

	// ---- Data Lists and counters ----
	private static final List<NewsItem> newsList = new ArrayList<NewsItem>();
	private static List<Feed> feedsList = new ArrayList<Feed>();
	private static List<FeedGroup> groupsList = new ArrayList<FeedGroup>();

	private static String currentFeedUrl;
	private static int groupIndex = 0;
	private static int feedIndex = 0;
	private static int messageCount = 0;

	private static long endTime;
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

	private static int twitterTermsCount = 399; // Twitter's limit is 400

	// ---- Initialization ----
	private static BlockingQueue<String> msgQueue = new LinkedBlockingQueue<String>(100000);
	//private static  BlockingQueue<Event> eventQueue = new LinkedBlockingQueue<Event>(1000);

	private static StatusesFilterEndpoint hosebirdEndpoint = new StatusesFilterEndpoint();
	private static Authentication hosebirdAuth = new OAuth1(consumerKey, consumerSecret, token, secret);

	/* ============================================= */


	public static void main( String[] args )
	{
		try {

			dbManager = new DatabaseManager();

			endTime = System.currentTimeMillis() + TIMEOUT*1000; // Timeout after 20 seconds
			// long startTime = System.currentTimeMillis / 1000;
			int repetitions = 0;

			state = STATE.IDLE;
			

			// ================= Main Loop ================
			while ( System.currentTimeMillis() < endTime && !stopLoop ) {

				switch (state){

					// ------------ Idle State ------------
					case IDLE:
						message = new ControlMessage(checkInput(true));

						// Wait for start command
						if( message.getCommand().equals("start") ){

							System.out.println("Start command received, starting...");

							start();							
							state = STATE.KEYWORDS;
						}

						break;

					// ----- Keyword Extraction State -----
					case KEYWORDS:

						checkInput(false);

						try{
						
							processSingleFeed();
						
						} catch(SSLException e){
							System.out.println("RSS over https connection not supported!");
						}

						if( nextFeed() ){
							System.out.println("News Items extraction done, storing to database...");
							state = STATE.SETUP;
						}
						
						break;

					// -- Database & Stream Setup State ---
					case SETUP:

						// setupDatabase();
						setupStream();						

						System.out.println("Setup done, starting live stream...");
						state = STATE.LIVE;
						break;

					// ------- Live Streaming State -------
					case LIVE:

						System.out.print("Message: ");
						// String msg = msgQueue.take();
						// System.out.println(msg);

						// TODO MARKER

						System.out.println(repetitions);
						repetitions++;
						if(repetitions >= 30){
							stopLoop = true;
						}						
						break;
				}
			}



		// ==== Termination & Error Handling ====

		} catch (IOException e) {
			e.printStackTrace();
		} catch (IllegalStateException e) {
			e.printStackTrace();
		// } catch(InterruptedException e){
		// 	e.printStackTrace();
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try {
				System.out.println(hosebirdClient);
				dbManager.close();
				hosebirdClient.stop();
				bufferedReader.close();

			} catch (IOException e) {
				e.printStackTrace();
			} catch (NullPointerException e) {
				e.printStackTrace();
			} catch (SQLException e) {
				e.printStackTrace();
			}
		}
	}

	private static String checkInput(boolean block) throws IOException{

		if( block || (!block && bufferedReader.ready()) ){ // if blocking, or stdin not empty

			return bufferedReader.readLine();
		} else {
			return null;
		}
	}

	private static void start() {

		groupsList = message.getGroups();
		feedsList.clear();
		newsList.clear();
		rejectDate = message.getRejectDate();

		groupIndex = 0;
		feedIndex = 0;
	}

	private static void processSingleFeed() throws SSLException {

		// Get final copies of variables for reading inside the streams
		final LocalDate filterDate = rejectDate;

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
			.filter( headline ->
				LocalDate.parse(headline.getPubDate(), rssDateFormat).isAfter(filterDate)
			)
			// Turn remaining headlines into news items
			.map( headline -> 
				new NewsItem(headline.getTitle() + " " + headline.getDescription(), feed) 
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
						if(newsItem.equals(oldNewsItem)){
							// merge with old NewsItem
							oldNewsItem.addFeed(feed);
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
			return false;

		} else if (groupIndex < groupsList.size()-1){

			groupIndex++;
			feedIndex = 0;
			return false;

		} else {
			// Keyword extraction done
			return true;			
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
	}

	private static void setupStream() {

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
			.limit(twitterTermsCount)
			.map(Map.Entry::getKey)
			.map(String::toLowerCase)
			// .peek(word->System.out.println(word))
			.collect(Collectors.toList());

		hosebirdEndpoint.trackTerms(finalKeywords);

		System.out.println("Setting up twitter stream...");

		// Final setup
		hosebirdClient = new ClientBuilder()
			.name("Hosebird-Client-01") 		// optional: mainly for logging
			.hosts(Constants.STREAM_HOST)
			.authentication(hosebirdAuth)
			.endpoint(hosebirdEndpoint)
			.processor(new StringDelimitedProcessor(msgQueue))
			.proxy("icache.intranet.gr", 80)
			// .eventMessageQueue(eventQueue)		// optional: to process client events
			.build();


		// Show time
		hosebirdClient.connect();
	}

	private static processSingleTweet(){

	}
}
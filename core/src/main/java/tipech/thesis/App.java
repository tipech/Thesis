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

	private static STATE state;

	private static BufferedReader bufferedReader;
	private static DatabaseManager dbManager;
	private static Client hosebirdClient;


	public static void main( String[] args )
	{
			Hosts hosebirdHosts = new HttpHosts(Constants.STREAM_HOST);
		try {
			/* =============== General Setup =============== */

			// ---- Configuration ----
			long TIMEOUT = System.currentTimeMillis() + 20*1000; // Timeout after 20 seconds

			// ---- Initialization ----
			state = STATE.IDLE;
			
			bufferedReader = new BufferedReader(new InputStreamReader(System.in));
			dbManager = new DatabaseManager();

			// long startTime = System.currentTimeMillis / 1000;
			DateTimeFormatter rssDateFormat = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz");
			LocalDate rejectDate = null;

			KeywordExtractor keywordExtractor = new KeywordExtractor();

			/* ============================================= */


			/* =============== Twitter Setup =============== */

			// ---- Configuration ----
			String consumerKey = "ZAPfZLcBhYEBCeRSAK5PqkTT7";
			String consumerSecret = "M81KvgaicyJIaQegdgXcdKDeZrSsJz4AVrGv3yoFwuItQQPMay";
			String token = "2591998746-Mx8ZHsXJHzIxAaD2IxYfmzYuL3pYNVnvWoHZgR5";
			String secret = "LJDvEa0jL7QJXxql0NVrULTAniLobe2TAAlnBdXRfm1xF";

			int twitterTermsCount = 399;

			// ---- Initialization ----
			BlockingQueue<String> msgQueue = new LinkedBlockingQueue<String>(100000);
			// BlockingQueue<Event> eventQueue = new LinkedBlockingQueue<Event>(1000);

			Authentication hosebirdAuth = new OAuth1(consumerKey, consumerSecret, token, secret);

			StatusesFilterEndpoint hosebirdEndpoint = new StatusesFilterEndpoint();

			/* ============================================= */


			// --------- Internal Loop variables ----------
			boolean done = false;
			
			final List<NewsItem> newsList = new ArrayList<NewsItem>();
			List<Feed> feedsList = new ArrayList<Feed>();
			List<FeedGroup> groupsList = new ArrayList<FeedGroup>();
			int groupIndex = 0;
			int feedIndex = 0;
			int messageCount = 0;
			String feedUrl;

			int repetitions = 0;

			// ================= Main Loop ================
			while ( System.currentTimeMillis() < TIMEOUT && !done ) {

				switch (state){

					// ------------ Idle State ------------
					case IDLE:
						ControlMessage message = new ControlMessage(checkInput(true));

						// Wait for start command
						if( message.getCommand().equals("start") ){

							groupsList = message.getGroups();
							feedsList.clear();
							newsList.clear();
							rejectDate = message.getRejectDate();

							groupIndex = 0;
							feedIndex = 0;


							System.out.println("Start command received, starting...");
							state = STATE.KEYWORDS;
						}

						break;

					// ----- Keyword Extraction State -----
					case KEYWORDS:

						checkInput(false);

						// Get final copies of variables for reading inside the streams
						final LocalDate filterDate = rejectDate;

						// Fetch a single feed from a single group
						feedUrl = groupsList.get(groupIndex).getFeedUrls().get(feedIndex);
						System.out.println("Fetching RSS and extracting keywords from: "+ feedUrl);
						try{

							// RSS fetching
							RSSFeedParser parser = new RSSFeedParser(feedUrl);
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
							
						} catch(SSLException e){
							System.out.println("RSS over https connection not supported!");
						}

						// Move on to the next feed/group
						if (feedIndex < groupsList.get(groupIndex).getFeedUrls().size()-1){

							feedIndex++;
						} else if (groupIndex < groupsList.size()-1){

							groupIndex++;
							feedIndex = 0;
						} else {
							// Keyword extraction done
							System.out.println("News Items extraction done, storing to database...");
							state = STATE.SETUP;
						}						
						break;

					// -- Database & Stream Setup State ---
					case SETUP:

						// -------- Database Setup --------

						// // Store the feed groups
						System.out.println("Storing feed groups");				
						dbManager.saveFeedGroups( groupsList );

						// Store the feeds
						System.out.println("Storing feeds");	
						dbManager.saveFeeds( feedsList );

						// Store the news items
						System.out.println("Storing news items");	
						dbManager.saveNews( newsList );


						// -------- Stream Setup --------

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

						// Final setup
						hosebirdClient = new ClientBuilder()
							.name("Hosebird-Client-01") 		// optional: mainly for logging
							.hosts(hosebirdHosts)
							.authentication(hosebirdAuth)
							.endpoint(hosebirdEndpoint)
							.processor(new StringDelimitedProcessor(msgQueue))
    						// .proxy("icache.intranet.gr", 80)
							// .eventMessageQueue(eventQueue)		// optional: to process client events
    						.build();


						// Show time
						hosebirdClient.connect();

						System.out.println("Database storage done, starting live stream...");
						state = STATE.LIVE;
						break;

					// ------- Live Streaming State -------
					case LIVE:
						try{
							System.out.print("Message: ");
							String msg = msgQueue.take();
							System.out.println(msg);

						} catch(InterruptedException e){
							e.printStackTrace();
						}

						System.out.println(repetitions);
						repetitions++;
						if(repetitions >= 30){
							done = true;
						}						
						break;
				}
			}



		// ==== Termination & Error Handling ====

		} catch (IOException e) {
			e.printStackTrace();
		} catch (IllegalStateException e) {
			e.printStackTrace();
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
}
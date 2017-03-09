package tipech.thesis;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Comparator;

import java.util.stream.Stream;
import java.util.stream.Collectors;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.IllegalStateException;
import javax.net.ssl.SSLException;


import tipech.thesis.entities.ControlMessage;
import tipech.thesis.entities.FeedGroup;
import tipech.thesis.entities.Feed;
import tipech.thesis.entities.FeedItem;
import tipech.thesis.entities.NewsItem;

import tipech.thesis.extraction.RSSFeedParser;
import tipech.thesis.extraction.KeywordExtractor;


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


	public static void main( String[] args )
	{
		try {

			// ---------- General configuration -----------
			long TIMEOUT = System.currentTimeMillis()+ 20*1000;
			int TWITTER_TERMS_COUNT = 390;

			state = STATE.IDLE;


			// ---------- Objects Initialization ----------
			bufferedReader = new BufferedReader(new InputStreamReader(System.in));

			DateTimeFormatter rssDateFormat = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz");
			LocalDate rejectDate = null;

			KeywordExtractor keywordExtractor = new KeywordExtractor();


			// --------- Internal Loop variables ----------
			boolean done = false;
			
			final List<NewsItem> newsList = new ArrayList<NewsItem>();
			List<Feed> feedsList = new ArrayList<Feed>();
			List<FeedGroup> groupsList = new ArrayList<FeedGroup>();
			int groupIndex = 0;
			int feedIndex = 0;
			int messageCount = 0;
			String feedUrl;



			// ============ Main Loop ===========
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
						feedUrl = groupsList.get(groupIndex).getFeeds().get(feedIndex);
						System.out.println("Fetching RSS and extracting keywords from: "+ feedUrl);
						try{

							// RSS fetching
							RSSFeedParser parser = new RSSFeedParser(feedUrl);
							Feed feed = parser.readFeed();
							feedsList.add(feed);
							List<FeedItem> feedItems = feed.getEntries();

							List<NewsItem> newNewsItems = feedItems.stream()
								// Filter out too old
								.filter( headline ->
									LocalDate.parse(headline.getPubDate(), rssDateFormat).isAfter(filterDate)
								)
								// Extract keywords
								.map( headline ->
									keywordExtractor
										.extract( headline.getTitle() +"\n"+ headline.getDescription() )
										.entrySet()
								)
								// Filter out too small
								.filter( keywordSet ->
									// Aggregate counts and compare sum
									keywordSet.stream()
										.reduce(
											0,
											(sum, word) -> sum + word.getValue(),
											(sum1, sum2) -> sum1 + sum2
										) > 2
								)
								// Turn remaining sets into news items
								.map( keywordSet ->
									new NewsItem( 
										keywordSet.stream().collect(Collectors.toMap(Entry::getKey, Entry::getValue)),
										feed
									)
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
								.collect(Collectors.toList());

							newsList.addAll( newNewsItems );
							
						} catch(SSLException e){
							System.out.println("RSS over https connection not supported!");
						}

						// Move on to the next feed/group
						if (feedIndex < groupsList.get(groupIndex).getFeeds().size()-1){

							feedIndex++;
						} else if (groupIndex < groupsList.size()-1){

							groupIndex++;
							feedIndex = 0;
						} else {
							// Keyword extraction done
							state = STATE.SETUP;
						}						
						break;

					// -------  Stream Setup State --------
					case SETUP:
						// System.out.println(newsList);

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
        					.limit(TWITTER_TERMS_COUNT)
        					.map(Map.Entry::getKey)
        					.map(String::toLowerCase)
        					.peek(word->System.out.println(word))
        					.collect(Collectors.toList());

        				System.out.println(finalKeywords);


						

						state = STATE.LIVE;
						break;

					// ------- Live Streaming State -------
					case LIVE:
						done = true;
						break;
				}
			}



		// ==== Termination & Error Handling ====

		} catch (IOException e) {
			e.printStackTrace();
		} catch (IllegalStateException e) {
			e.printStackTrace();
		} finally {
			try {
				if (bufferedReader != null) {
					bufferedReader.close();
				}
			} catch (IOException e) {
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
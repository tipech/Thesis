package tipech.thesis;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import java.util.stream.Collectors;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.IllegalStateException;
import javax.net.ssl.SSLException;

import com.sree.textbytes.jtopia.Configuration;
import com.sree.textbytes.jtopia.TermsExtractor;
import com.sree.textbytes.jtopia.TermDocument;

import tipech.thesis.extraction.ControlMessage;
import tipech.thesis.extraction.Group;
import tipech.thesis.extraction.Feed;
import tipech.thesis.extraction.FeedMessage;
import tipech.thesis.extraction.RSSFeedParser;


/**
 * 
 *
 */
public class App 
{

	public enum STATE {
		IDLE, KEYWORDS, LIVE
	}

	private static STATE state;

	private static final long TIMEOUT = System.currentTimeMillis()+ 20*1000;
	private static BufferedReader bufferedReader;


	public static void main( String[] args )
	{
		try {

			bufferedReader = new BufferedReader(new InputStreamReader(System.in));

			state = STATE.IDLE;
			boolean done = false;
			List<Group> groupsList = new ArrayList<Group>();
			int groupIndex = 0;
			int feedIndex = 0;
			int messageCount = 0;
			String input;
			String feedUrl;

			LocalDate rejectDate = null;
        	DateTimeFormatter rssDateFormat = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz");

			// ----- Keyword extraction configuration -----
			// Options:
			// "default":  "lib/jtopia/model/default/english-lexicon.txt"
			// "openNLP":  "lib/jtopia/model/openNLP/en-pos-maxent.bin"
			// "stanford": "lib/jtopia/model/stanford/english-left3words-distsim.tagger"
			Configuration.setTaggerType("stanford");
			Configuration.setModelFileLocation("lib/jtopia/model/stanford/english-left3words-distsim.tagger");
			Configuration.setSingleStrength(1);
			Configuration.setNoLimitStrength(1);
			TermsExtractor termExtractor = new TermsExtractor();
			TermDocument termDocument = new TermDocument();

			// ============ Main Loop ===========
			while ( System.currentTimeMillis() < TIMEOUT && !done ) {

				switch (state){

					// ------------ Idle State ------------
					case IDLE:
						ControlMessage message = new ControlMessage(checkInput(true));

						// Wait for start command
						if( message.getCommand().equals("start") ){

							groupsList = message.getGroups();
							rejectDate = message.getRejectDate();

							state = STATE.KEYWORDS;
							groupIndex = 0;
							feedIndex = 0;
							System.out.println("Start command received, Fetching RSS...");
						}

						break;

					// ----- Keyword Extraction State -----
					case KEYWORDS:

						input = checkInput(false);

						// Fetch a single feed from a single group
						feedUrl = groupsList.get(groupIndex).getFeeds().get(feedIndex);
						System.out.println("Fetching RSS and extracting keywords from: "+ feedUrl);
						try{

							// RSS fetching
							RSSFeedParser parser = new RSSFeedParser(feedUrl);
							Feed feed = parser.readFeed();
							for (FeedMessage headline : feed.getEntries()) {


								// Data filtering
								if( LocalDate.parse(headline.getPubDate(), rssDateFormat).isAfter(rejectDate) ){
								




									// Keyword extraction
									System.out.println(headline.getTitle());
									System.out.println(headline.getDescription());
									termDocument = termExtractor.extractTerms(headline.getTitle() + " " + headline.getDescription());
									System.out.println(termDocument.getFinalFilteredTerms());
									System.out.println("");

									messageCount++;
								}


								

							}

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
							System.out.println(messageCount);
							state = STATE.LIVE;
						}						
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

	private static List<String> extractKeywords(String message){
		return null;
	}
}






		// Map<Integer, String> HOSTING = new HashMap<>();
		// HOSTING.put(1, "linode.com");
		// HOSTING.put(2, "heroku.com");
		// HOSTING.put(3, "digitalocean.com");
		// HOSTING.put(4, "aws.amazon.com");

		// String result = "";
		// for (Map.Entry<Integer, String> entry : HOSTING.entrySet()) {
		//	  if ("aws.amazon.com".equals(entry.getValue())) {
		//		  result = entry.getValue();
		//	  }
		// }
		// System.out.println("Before Java 8 : " + result);

		// //Map -> Stream -> Filter -> String
		// result = HOSTING.entrySet().stream()
		//		  .filter(map -> "aws.amazon.com".equals(map.getValue()))
		//		  .map(map -> map.getValue())
		//		  .collect(Collectors.joining());

		// System.out.println("With Java 8 : " + result);


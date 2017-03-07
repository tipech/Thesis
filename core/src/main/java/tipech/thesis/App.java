package tipech.thesis;

import java.util.HashMap;
import java.util.Map;

import java.util.List;
import java.util.ArrayList;

import java.util.stream.Collectors;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.IllegalStateException;
import javax.net.ssl.SSLException;
import java.net.URISyntaxException;

import rake4j.core.model.Document;
import rake4j.core.RakeAnalyzer;

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
			String input;
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

							// Keyword extraction
							for (FeedMessage headline : feed.getEntries()) {

								System.out.println(headline);

								Document doc = new Document(headline.getTitle());
								RakeAnalyzer rake = new RakeAnalyzer();
								rake.loadDocument(doc);
								rake.run();
								System.out.println(doc.termMapToString());

							}

						} catch(SSLException e){
							System.out.println("RSS over https connection not supported!");
						} catch(URISyntaxException e){
							System.out.println("Something went wrong during keyword extraction!");
						}

						// Move on to the next feed/group
						if (feedIndex < groupsList.get(groupIndex).getFeeds().size()-1){

							feedIndex++;
						} else if (groupIndex < groupsList.size()-1){

							groupIndex++;
							feedIndex = 0;
						} else {
							// Keyword extraction done
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


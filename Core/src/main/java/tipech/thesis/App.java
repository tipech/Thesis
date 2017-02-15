package tipech.thesis;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

import java.lang.Exception;

import tipech.thesis.extraction.Feed;
import tipech.thesis.extraction.FeedMessage;
import tipech.thesis.extraction.RSSFeedParser;


/**
 * 
 *
 */
public class App 
{
	public static void main( String[] args ) throws InterruptedException
	{       


		// RSSFeedParser parser = new RSSFeedParser("http://www.vogella.com/article.rss");
		// Feed feed = parser.readFeed();
		// System.out.println(feed);

		// for (FeedMessage message : feed.getMessages()) {
		//	 System.out.println(message);

		// }




		System.out.println("Started");

		for (int i=0; i<5 ; i++ ) {

            System.out.println("Running");
            System.out.println(i);
			Thread.sleep(1000);			
		}









		// Map<Integer, String> HOSTING = new HashMap<>();
		// HOSTING.put(1, "linode.com");
		// HOSTING.put(2, "heroku.com");
		// HOSTING.put(3, "digitalocean.com");
		// HOSTING.put(4, "aws.amazon.com");

		// String result = "";
		// for (Map.Entry<Integer, String> entry : HOSTING.entrySet()) {
		//      if ("aws.amazon.com".equals(entry.getValue())) {
		//	      result = entry.getValue();
		//      }
		// }
		// System.out.println("Before Java 8 : " + result);

		// //Map -> Stream -> Filter -> String
		// result = HOSTING.entrySet().stream()
		//	      .filter(map -> "aws.amazon.com".equals(map.getValue()))
		//	      .map(map -> map.getValue())
		//	      .collect(Collectors.joining());

		// System.out.println("With Java 8 : " + result);

	}
}

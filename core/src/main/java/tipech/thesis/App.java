package tipech.thesis;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;

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
import tipech.thesis.extraction.FeedGroup;
import tipech.thesis.extraction.Feed;
import tipech.thesis.extraction.FeedItem;
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

	private static BufferedReader bufferedReader;
	private static TermsExtractor termExtractor;


	public static void main( String[] args )
	{
		try {

			// ---------- General configuration -----------
			long TIMEOUT = System.currentTimeMillis()+ 20*1000;
			state = STATE.IDLE;


			// ----- Keyword extraction configuration -----
			// Options:
			// "default":  "lib/jtopia/model/default/english-lexicon.txt"
			// "openNLP":  "lib/jtopia/model/openNLP/en-pos-maxent.bin"
			// "stanford": "lib/jtopia/model/stanford/english-left3words-distsim.tagger"
			Configuration.setTaggerType("stanford");
			Configuration.setModelFileLocation("lib/jtopia/model/stanford/english-left3words-distsim.tagger");
			Configuration.setSingleStrength(1);
			Configuration.setNoLimitStrength(1);

			// --------- Internal Loop variables ----------
			boolean done = false;
			String input;

			bufferedReader = new BufferedReader(new InputStreamReader(System.in));
			termExtractor = new TermsExtractor();

			DateTimeFormatter rssDateFormat = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz");
			LocalDate rejectDate = null;
			
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
							for (FeedItem headline : feed.getEntries()) {

								// Data filtering by date
								if( LocalDate.parse(headline.getPubDate(), rssDateFormat).isAfter(rejectDate) ){
								
									System.out.println( "\n" + headline.getTitle() + "\n" + headline.getDescription() );

									// Keyword extraction
									extractKeywords( headline.getTitle() + "\n" + headline.getDescription() );

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

	private static Map<String, ArrayList<Integer>> extractKeywords(String message){

		// Get terms
		TermDocument termDocument = new TermDocument();
		termDocument = termExtractor.extractTerms( message );
		Map<String, ArrayList<Integer>> keywords = termDocument.getFinalFilteredTerms();
		Map<String, ArrayList<Integer>> filteredKeywords = null;

		System.out.println( keywords );

		// Split key phrases with more than three words
		filteredKeywords = keywords.entrySet().stream()
			.flatMap(keyword -> {

				if( keyword.getValue().get(1) < 3){
					return Stream.of(keyword);

				} else {

					Map<String, ArrayList<Integer>> splitWords = new HashMap<String, ArrayList<Integer>>();
					String[] words = keyword.getKey().split(" ");
					String newWord = "";
					int wordCount = 0;

					// Loop through single words of key phrase
					for (int i=0; i < words.length; i++) {
						
						if(wordCount < 2){
							// Still a single key phrase
							newWord += " " + words[i];
							wordCount++;
						
						} else {
							// Too many words, store previous key phrase...
							ArrayList<Integer> values = new ArrayList<Integer>();
							values.add(keyword.getValue().get(0)); // count in text, same as parent
							values.add(2); // word count / strength: 2
							splitWords.put(newWord, values);

							// ... and start a new one
							newWord = words[i];
							wordCount = 1;
						}
					}

					// if a last word remains, add it
					if(wordCount > 0){
						ArrayList<Integer> values = new ArrayList<Integer>();
						values.add(keyword.getValue().get(0)); // count in text, same as parent
						values.add(1); // word count / strength: 1
						splitWords.put(newWord, values);						
					}



					return splitWords.entrySet().stream();
				}
			})
			.collect(Collectors.toMap(
				keyword -> keyword.getKey(), 
				keyword -> keyword.getValue(),  
				(word1, word2) -> { // if split resulted in same words, add counts
					word1.set(0, word1.get(0) + word2.get(0));
					return word1;
				}));

		System.out.println( filteredKeywords );

		return filteredKeywords;
	}
}
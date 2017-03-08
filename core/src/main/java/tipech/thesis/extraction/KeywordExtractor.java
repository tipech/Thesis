package tipech.thesis.extraction;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;
import java.util.stream.Collectors;

import com.sree.textbytes.jtopia.Configuration;
import com.sree.textbytes.jtopia.TermsExtractor;
import com.sree.textbytes.jtopia.TermDocument;

import tipech.thesis.entities.Feed;
import tipech.thesis.entities.FeedItem;


/**
 * 
 *
 */
public class KeywordExtractor {

	private static TermsExtractor termExtractor;

	public KeywordExtractor() {

		// ----- Keyword extraction configuration -----
		// Options:
		// "default":  "lib/jtopia/model/default/english-lexicon.txt"
		// "openNLP":  "lib/jtopia/model/openNLP/en-pos-maxent.bin"
		// "stanford": "lib/jtopia/model/stanford/english-left3words-distsim.tagger"
		Configuration.setTaggerType("stanford");
		Configuration.setModelFileLocation("lib/jtopia/model/stanford/english-left3words-distsim.tagger");
		Configuration.setSingleStrength(1);
		Configuration.setNoLimitStrength(1);

		termExtractor = new TermsExtractor();
	}

	public static Map<String, ArrayList<Integer>> extract( String message ) {

		// Get terms
		TermDocument termDocument = new TermDocument();
		termDocument = termExtractor.extractTerms( message );
		Map<String, ArrayList<Integer>> keywords = termDocument.getFinalFilteredTerms();
		Map<String, ArrayList<Integer>> filteredKeywords = null;

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

		// System.out.println( message );
		// System.out.println( filteredKeywords );

		return filteredKeywords;
	}

	
}
package tipech.thesis.extraction;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

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

	public static Map<String, Integer> extract( String message ) {

		// Get terms
		TermDocument termDocument = new TermDocument();
		termDocument = termExtractor.extractTerms( message );
		Map<String, ArrayList<Integer>> keyphrases = termDocument.getFinalFilteredTerms();
		Map<String, Integer> keywords = null;

		// Split key phrases to single words
		keywords = keyphrases.entrySet().stream()
			.flatMap(keyword -> {

				Map<String, Integer> splitWords = new HashMap<String, Integer>();
				int count = keyword.getValue().get(0);

				if( keyword.getValue().get(1) == 1){

					splitWords.put( keyword.getKey(), count );

				} else {

					Stream.of(keyword.getKey().split(" "))
						.forEach( word -> splitWords.put( word, count ) );
				}

				return splitWords.entrySet().stream();
			})
			.collect(Collectors.toMap(
				Entry::getKey, 
				Entry::getValue,  
				(count1, count2) -> count1 + count2 // if split resulted in same words, add counts
			));

		return keywords;
	}

	
}
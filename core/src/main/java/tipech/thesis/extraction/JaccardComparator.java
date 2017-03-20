package tipech.thesis.extraction;

import java.util.Set;
import java.util.HashSet;
import java.util.List;

import java.lang.Math;

import java.util.stream.Stream;
import java.util.stream.Collectors;


import java.util.Random;


/*
 * Calculates the similarity of sets of words using the Jaccard algorithm
 */
public class JaccardComparator {


	public double similarity(List<String> list1, List<String> list2){

		return similarity(list1, list2, false, false);
	}
	
	public double similarity(List<String> list1, List<String> list2, boolean exact){

		return similarity(list1, list2, exact, false);
	}

	public double similarity(List<String> list1, List<String> list2, boolean exact, boolean weighted){

		Set<String> set1 = new HashSet<String>(list1);
		Set<String> set2 = new HashSet<String>(list2);

		Set<String> intersection = getIntersection(set1,set2, exact); 			// Get intersection

		if(intersection.isEmpty()){
			return 0;
		}

		Set<String> union = getUnion(set1,set2, intersection, exact); 			// Get union

		double jaccard = (double)intersection.size() / (double)union.size(); 	// Jaccard divison
		
		if(!weighted){

			return jaccard;
		} 

		double wJaccard = jaccard * (intersection.size() / 3 );
		wJaccard =  Math.min(wJaccard, 1.0);

		if (wJaccard > 0.1) {
			
		}

		return wJaccard;
	}

	private Set<String> getIntersection(Set<String> set1, Set<String> set2, boolean exact){

		return set1.stream()
			.filter( word -> 	// Count common(ish) words
				set2.stream()
					.filter( otherWord -> 						
						word.toLowerCase().equals( otherWord.toLowerCase() ) || 	// check for same words	
						( !exact && isSimilar( word, otherWord ) )	// and if not exact, also check for similar words
					)
					.count() > 0 // there were common words
			)
			.collect(Collectors.toSet());
	}


	private Set<String> getUnion(Set<String> set1, Set<String> set2, Set<String> intersection, boolean exact ){

		return Stream.concat( set1.stream().map(String::toLowerCase), set2.stream().map(String::toLowerCase) )
			.filter( word -> 
				exact ||				// if exact, union keeps similar words
				intersection.stream()	// else filter out similar in intersection from union
					.filter( intersectionWord -> // if not same but contained, discard
						!word.toLowerCase().equals( intersectionWord.toLowerCase() ) &&
						word.toLowerCase().contains( intersectionWord.toLowerCase())
					)
					.count() == 0 // no words in intersection contained in this union word, keep it
			)
			.collect(Collectors.toSet());
	}

	private boolean isSimilar( String word1, String word2 ){

		return ( word1.length() >= 4 && word2.length() >= 4 &&
			(
				word1.toLowerCase().contains( word2.toLowerCase() ) ||
				word2.toLowerCase().contains( word1.toLowerCase() )
			)							  
		);
	}

	private double averageLength(Set<String> words){

		return words.stream()
			.mapToInt(String::length)
			.average()
			.getAsDouble();
	}

}
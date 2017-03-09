package tipech.thesis.extraction;

import java.util.Set;
import java.util.HashSet;
import java.util.List;

import java.util.stream.Stream;
import java.util.stream.Collectors;


import java.util.Random;


/*
 * Calculates the similarity of sets of words using the Jaccard algorithm
 */
public class JaccardComparator {


	public double similarity(List<String> list1, List<String> list2){

		Set<String> set1 = new HashSet<String>(list1);
		Set<String> set2 = new HashSet<String>(list2);

		return similarity(set1, set2);
	}

	public double similarity(Set<String> set1, Set<String> set2){

		// Get intersection
		Set<String> intersection = getIntersection(set1,set2);


		if(!intersection.isEmpty()){

			// Get union
			Set<String> union = getUnion(set1,set2, intersection);

			// Do the jaccard divison
			return (double)intersection.size() / (double)union.size();

		} else {

			return 0;
		}
	}

	private Set<String> getIntersection(Set<String> set1, Set<String> set2){

		return set1.stream()
			.filter( word -> 
				// Count common(ish) words
				set2.stream()
					.filter( otherWord -> // check for same words or not small words with different ending
						word.toLowerCase().equals( otherWord.toLowerCase() ) ||
						(
							word.length() >= 4 && 
							otherWord.length() >= 4 &&
							(
								word.toLowerCase().contains( otherWord.toLowerCase() ) ||
								otherWord.toLowerCase().contains( word.toLowerCase() )
							)							  
						)
						
					)
					.count() > 0 // there were common words
			)
			.collect(Collectors.toSet());
	}


	private Set<String> getUnion(Set<String> set1, Set<String> set2, Set<String> intersection){

		return Stream.concat( set1.stream(), set2.stream() )
			.filter( word -> // filter out larger words containing smaller ones already intersected
			
				intersection.stream()
					.filter( intersectionWord -> // if not same but contained, discard
						!word.toLowerCase().equals( intersectionWord.toLowerCase() ) &&
						word.toLowerCase().contains( intersectionWord.toLowerCase())
					)
					.count() == 0 // there exist no words in intersection contained in this one
			)
			.collect(Collectors.toSet());
	}

}
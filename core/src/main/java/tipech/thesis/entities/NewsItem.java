package tipech.thesis.entities;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;

import java.util.stream.Collectors;

import tipech.thesis.extraction.JaccardComparator;

/*
 * Represents one News Item
 */
public class NewsItem {

	private Map<String, Integer> terms;
	private List<Feed> feeds;

	public NewsItem(Map<String, Integer> terms, Feed feed) {

		this.terms = terms;
		feeds = new ArrayList<Feed>();
		feeds.add(feed);
	}

	public void addFeed(Feed feed) {

		feeds.add(feed);
	}

	public Map<String, Integer> getTerms(){

		return terms;
	}

	public List<String> getKeywords(){

		return new ArrayList<String>(terms.keySet());
	}


	@Override
	public boolean equals(Object otherObject){

		NewsItem other = (NewsItem) otherObject;

		JaccardComparator comparator = new JaccardComparator();

		return comparator.similarity(this.getKeywords(), other.getKeywords()) > threshold;
	}

	@Override
	public String toString() {
		return "\n\nNewsItem [terms=" + terms + ", feeds=" + 
			feeds.stream().map(f -> f.getUrl()).collect(Collectors.toList()) + "]";
	}

	// Static Members
	private static double threshold = 0.3;

	public static void setThreshold(double value){

		threshold = value;
	}

}
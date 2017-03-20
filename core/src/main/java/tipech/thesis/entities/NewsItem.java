package tipech.thesis.entities;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;

import java.util.stream.Collectors;

import java.util.concurrent.atomic.AtomicInteger;

import tipech.thesis.extraction.KeywordExtractor;
import tipech.thesis.extraction.JaccardComparator;

/*
 * Represents one News Item
 */
public class NewsItem {

	private int id;
	private String title;
	private List<Feed> feeds;
	private Map<String, Integer> terms;
	private Tweet lastTweet;

	public NewsItem(String title, Feed feed){

		this.title = title;
		feeds = new ArrayList<Feed>();
		feeds.add(feed);
	}


	public int getId() {
		return id;
	}

	public void setId(){

		this.id = uniqueId.getAndIncrement();
	}

	public String getTitle() {
		return title;
	}

	public List<Feed> getFeeds(){
		return feeds;
	}

	public void addFeed(Feed feed) {

		feeds.add(feed);
	}

	public void extractTerms(KeywordExtractor keywordExtractor){
			
		this.terms = keywordExtractor.extract( title );
	}

	public Map<String, Integer> getTerms(){

		return terms;
	}

	public List<String> getKeywords(){

		return new ArrayList<String>(terms.keySet());
	}

	public String getKeywordString(){

		return String.join( " ", this.getKeywords() );
	}

	public Tweet getLastTweet(){
		return lastTweet;
	}

	public void setLastTweet(Tweet lastTweet){
		this.lastTweet = lastTweet;
	}


	@Override
	public boolean equals(Object otherObject){

		NewsItem other = (NewsItem) otherObject;

		JaccardComparator comparator = new JaccardComparator();

		return comparator.similarity(this.getKeywords(), other.getKeywords()) > threshold;
	}

	@Override
	public String toString() {
		return "\n\nNewsItem [title=" + title + ", terms=" + terms + ", feeds=" + 
			feeds.stream().map(f -> f.getUrl()).collect(Collectors.toList()) + "]";
	}

	// Static Members
	private static AtomicInteger uniqueId = new AtomicInteger();

	private static double threshold = 0.3;

	public static void setThreshold(double value){

		threshold = value;
	}

}
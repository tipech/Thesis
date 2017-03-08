package tipech.thesis.entities;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;

import java.util.stream.Collectors;

/*
 * Represents one News Item
 */
public class NewsItem {

	private Map<String, Integer> keywords;
	private List<Feed> feeds;

	public NewsItem(Map<String, Integer> keywords, Feed feed) {

		this.keywords = keywords;
		feeds = new ArrayList<Feed>();
		feeds.add(feed);
	}

	public void addFeed(Feed feed) {

		feeds.add(feed);
	}

	@Override
	public boolean equals(Object other){
		return false; // TODO implement news items comparison
	}

	@Override
	public String toString() {
		return "NewsItem [keywords=" + keywords + ", feeds=" + feeds.stream().map(f -> f.getUrl()).collect(Collectors.toList()) + "]\n";
	}

}
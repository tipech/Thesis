package tipech.thesis.entities;

import java.util.ArrayList;
import java.util.List;

import java.util.concurrent.atomic.AtomicInteger;

/*
 * Stores an RSS feed
 */
public class Feed {

	private static AtomicInteger uniqueId = new AtomicInteger();

	private final int id;
	private final String url;
	private final String title;
	private final String link;
	private final String description;
	private final String language;
	private final String copyright;
	private FeedGroup group;

	private final List<FeedItem> entries = new ArrayList<FeedItem>();

	public Feed(String url, String title, String link, String description, String language,
		String copyright) {
		this.url = url;
		this.title = title;
		this.link = link;
		this.description = description;
		this.language = language;
		this.copyright = copyright;
		this.id = uniqueId.getAndIncrement();	
		this.group = null;
	}

	public List<FeedItem> getEntries() {
		return entries;
	}

	public String getUrl() {
		return url;
	}

	public String getTitle() {
		return title;
	}

	public String getLink() {
		return link;
	}

	public String getDescription() {
		return description;
	}

	public String getLanguage() {
		return language;
	}

	public String getCopyright() {
		return copyright;
	}

	public int getId() {
		return id;
	}

	public void setGroup(FeedGroup group){
		this.group = group;
	}

	public FeedGroup getGroup() {
		return group;
	}

	@Override
	public String toString() {
		return "Feed " + url + " [copyright=" + copyright + ", description=" + description
		+ ", language=" + language + ", link=" + link + ", title=" + title + "]";
	}

}
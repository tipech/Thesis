package tipech.thesis.entities;

import java.util.ArrayList;
import java.util.List;

/*
 * Stores an RSS feed
 */
public class Feed {

	final String url;
	final String title;
	final String link;
	final String description;
	final String language;
	final String copyright;

	final List<FeedItem> entries = new ArrayList<FeedItem>();

	public Feed(String url, String title, String link, String description, String language,
		String copyright) {
		this.url = url;
		this.title = title;
		this.link = link;
		this.description = description;
		this.language = language;
		this.copyright = copyright;
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

	@Override
	public String toString() {
		return "Feed " + url + " [copyright=" + copyright + ", description=" + description
		+ ", language=" + language + ", link=" + link + ", title=" + title + "]";
	}

}
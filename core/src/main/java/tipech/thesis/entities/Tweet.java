package tipech.thesis.entities;

import java.util.List;
import java.util.Arrays;

import java.util.stream.Collectors;

import com.google.gson.JsonParser;
import com.google.gson.JsonObject;
import com.google.gson.JsonElement;

import tipech.thesis.extraction.JaccardComparator;

/*
 * Represents one stripped-down tweet
 */
public class Tweet {

	private long time;
	private String user;
	private String text;
	private List<String> words;

	public Tweet(String rawTweet) {

		JsonObject jsonTweet = new JsonParser().parse(rawTweet).getAsJsonObject();
		this.user = jsonTweet.get("user").getAsJsonObject().get("name").getAsString();
		this.text = jsonTweet.get("text").getAsString();
		this.time = jsonTweet.get("timestamp_ms").getAsLong();

		words = Arrays.asList( text.split(" |,|#|!|\\?|\\(|\\)|\\[|\\]|\"|\n|…") ).stream()
			.filter( word -> !word.startsWith("@") && !word.startsWith("ht") )
			.flatMap( word -> Arrays.asList( word.split("&amp;|&gt;|&lt;|\\.|:|;|@") ).stream() )
			// .filter( word -> word.matches("[\\p{InGreek}a-zA-Z0-9_\\-]+"))
			.filter( word -> word.length() >= 2 )
			.collect(Collectors.toList());

	}

	public long getTime() {
		return time;
	}

	public String getUser() {
		return user;
	}

	public String getText() {
		return text;
	}

	public List<String> getWords(){
		return words;
	}

	public void matchWith(NewsItem item, JaccardComparator comparator) {

		double similarity = comparator.similarity(getWords(), item.getKeywords(), true, true);

		if ( similarity > 0.1 ){

			System.out.println("It's a match! Similarity: " + similarity + ",\n News item: " + item.getTitle() + ",\n Tweet: " + text );
		}
	}

	@Override
	public String toString() {
		return "Tweet [text=" + text + ", words=" + words + ", time=" + time + ", user=" + user + "]";
	}

}
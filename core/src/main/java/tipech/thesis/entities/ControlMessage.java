package tipech.thesis.entities;

import java.util.ArrayList;
import java.util.List;

import java.time.LocalDate;

import java.io.BufferedReader;
import java.io.IOException;

import com.google.gson.Gson;
import com.google.gson.JsonParser;
import com.google.gson.JsonObject;
import com.google.gson.JsonElement;
import com.google.gson.JsonArray;

/*
 * Stores a message from the control backend
 */
public class ControlMessage {

	private String command;
	private LocalDate rejectDate; 		// reject everything before that date
	private double newsThreshold = 0.3; 	// news item cross-referencing similarity threshold
	private double tweetThreshold = 0.1; 	// news item - tweet similarity threshold
	private int statusRate = 5;			// how often status gets refreshed

	private final List<FeedGroup> groups = new ArrayList<FeedGroup>();

	public ControlMessage(BufferedReader bufferedReader, boolean block) throws IOException{

		if( block || (!block && bufferedReader.ready()) ){ // if blocking, or stdin not empty

			String rawMessage = bufferedReader.readLine();
			JsonObject message = new JsonParser().parse(rawMessage).getAsJsonObject();
			
			this.command = message.get("command").getAsString();

			if(message.has("data")){

				JsonObject data = message.get("data").getAsJsonObject();
				JsonObject settings = data.get("settings").getAsJsonObject();

				// Parse JSON into Groups and Feed urls
				JsonArray groupsJson = data.getAsJsonArray("groups");
				Gson gson = new Gson();
				
				for(final JsonElement groupJson : groupsJson) {

					FeedGroup group = gson.fromJson(groupJson.toString(), FeedGroup.class);
					group.updateId(); // manually set id because gson
					groups.add(group);
				}

				// Provide a list of accepted RSS entry dates based on date option
				String dateOption = settings.get("date").getAsString();
				
				switch (dateOption){
					case "week":
						this.rejectDate = LocalDate.now().minusDays(8); // previous week
						break;
					case "2days":
						this.rejectDate = LocalDate.now().minusDays(3); // 3 days+ ago
						break;
					default:
						this.rejectDate = LocalDate.now().minusDays(1); // yesterday
						break;
				}

				// Get status refresh rate and thresholds
				this.statusRate = settings.get("updatePeriod").getAsInt();
				this.newsThreshold = settings.get("newsThreshold").getAsDouble();
				this.tweetThreshold = settings.get("tweetThreshold").getAsDouble();
			} else {

				this.rejectDate = null;
			}
			
		} else {
			this.command = "none";
			this.rejectDate = null;
		}
	}

	public List<FeedGroup> getGroups() {
		return groups;
	}

	public LocalDate getRejectDate() {
		return rejectDate;
	}

	public String getCommand() {
		return command;
	}

	public double getNewsThreshold(){
		return newsThreshold;
	}

	public double getTweetThreshold(){
		return tweetThreshold;
	}

	public int getStatusRate(){
		return statusRate;
	}

	public boolean isEmpty() {
		return command.equals("none");
	}

	@Override
	public String toString() {
		return "Message: [command=" + command + "]";
	}

	// ---- Static Members ----

	public static boolean BLOCKING = true;
	public static boolean NONBLOCKING = false; 
}
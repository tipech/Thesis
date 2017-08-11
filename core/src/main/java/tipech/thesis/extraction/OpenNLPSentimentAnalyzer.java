package tipech.thesis.extraction;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
 
import opennlp.tools.doccat.DoccatModel;
import opennlp.tools.doccat.DocumentCategorizerME;
import opennlp.tools.doccat.DocumentSampleStream;
import opennlp.tools.util.ObjectStream;
import opennlp.tools.util.PlainTextByLineStream;


public class OpenNLPSentimentAnalyzer {

	private DocumentCategorizerME categorizer;

	public OpenNLPSentimentAnalyzer(String modelInput) {

		// ----- Model initialization -----

		InputStream dataIn = null;
		BufferedOutputStream modelOut = null;
		DoccatModel model = null;

		try {
			switch(modelInput){
				case "default":	// use pre-trained model					
					dataIn = new FileInputStream("../lib/models/openNLP-tweets-sentiment.bin");
					model = new DoccatModel(dataIn);
					break;

				case "new":  	// train and extract a new model from a file named input.txt
					dataIn = new FileInputStream("input.txt");
					modelOut = new BufferedOutputStream(new FileOutputStream("/lib/models/openNLP-tweets-sentiment.bin"));

					ObjectStream lineStream = new PlainTextByLineStream(dataIn, "UTF-8");
					ObjectStream sampleStream = new DocumentSampleStream(lineStream);
					// Specifies the minimum number of times a feature must be seen
					int cutoff = 2;
					int trainingIterations = 30;
					model = DocumentCategorizerME.train("en", sampleStream, cutoff,	trainingIterations);					
					model.serialize(modelOut);
					break;

				default:		// use pre-trained location from correct location (manual run)					
					dataIn = new FileInputStream("lib/models/openNLP-tweets-sentiment.bin");
					model = new DoccatModel(dataIn);
					break;
			}

		} catch (IOException e) {
			e.printStackTrace();
		} finally {
			if (dataIn != null) {
				try {
					if(dataIn != null ){
						dataIn.close();
					}
					if(modelOut != null ){
						modelOut.close();
					}
				} catch (IOException e) {
					e.printStackTrace();
				}
			}
		}

		categorizer = new DocumentCategorizerME(model);
	}

	public float findSentiment(String line) {
		
		double[] outcomes = categorizer.categorize(line);
		String category = categorizer.getBestCategory(outcomes);

		// our scale is 0 to 5, so we select 1 and 3 as the output, plus/minus 0.01 for rounding outwards 
		if (category.equalsIgnoreCase("1")) {

			return 3.01f;

		} else {
			return 0.99f;
		}
	}
}
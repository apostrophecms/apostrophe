var _ = require('underscore');
var ent = require('ent');
var extend = require('extend');
var XRegExp = require('xregexp').XRegExp;
_.str = require('underscore.string');

/**
 * search
 * @augments Augments the apos object with methods relating specifically to search.
 *
 * Apostrophe contains simple mechanisms for regex-based search which work surprisingly
 * well on projects up to a certain size. There comes a point where you'll want to
 * swap them out for something else, like elastic search.
 *
 */

module.exports = function(self) {
  // Turn the provided string into a string suitable for use as a slug.
  //
  // KEEP IN SYNC WITH BROWSER SIDE IMPLEMENTATION in user.js
  //
  // ONE punctuation character normally forbidden in slugs may optionally
  // be permitted by specifying it via options.allow. For implementation
  // reasons, this character may not be ʍ (upside sown lowercase m). That
  // character is always stripped out.

  self.slugify = function(s, options) {
    // Trim and deal with wacky cases like an array coming in without crashing
    s = self.sanitizeString(s);

    // By default everything that matches the XRegExp groups
    // "Punctuation", "Separator", "Other" and "Symbol" becomes a dash.
    // You can change the separator with options.separator

    if (!options) {
      options = {};
    }

    if (!options.separator) {
      options.separator = '-';
    }

    if (options.allow) {
      // Temporarily convert the allowed punctuation character to ʍ, which is
      // not punctuation and thus won't be removed when we clean out punctuation.
      // If JavaScript had character class subtraction this would not be needed

      // First remove any actual instances of ʍ to avoid unexpected behavior
      s = s.replace(new RegExp(RegExp.quote('ʍ'), 'g'), '');

      // Now / (or whatever options.allow contains) becomes ʍ temporarily
      s = s.replace(new RegExp(RegExp.quote(options.allow), 'g'), 'ʍ');
    }

    var r = '[\\p{Punctuation}\\p{Separator}\\p{Other}\\p{Symbol}]';
    var regex = new XRegExp(r, 'g');
    s = XRegExp.replace(s, regex, options.separator);
    // Turn ʍ back into the allowed character
    if (options.allow) {
      s = s.replace(new RegExp(RegExp.quote('ʍ'), 'g'), options.allow);
    }
    // Consecutive dashes become one dash
    var consecRegex = new RegExp(RegExp.quote(options.separator) + '+', 'g');
    s = s.replace(consecRegex, options.separator);
    // Leading dashes go away
    var leadingRegex = new RegExp('^' + RegExp.quote(options.separator));
    s = s.replace(leadingRegex, '');
    // Trailing dashes go away
    var trailingRegex = new RegExp(RegExp.quote(options.separator) + '$');
    s = s.replace(trailingRegex, '');
    // If the string is empty, supply something so that routes still match
    if (!s.length)
    {
      s = 'none';
    }
    s = s.toLowerCase();
    return s;
  };

  // Returns a string that, when used for searches and indexes, behaves
  // similarly to MySQL's default behavior for string matching, plus a little
  // extra tolerance of punctuation and whitespace differences. This is
  // in contrast to MongoDB's default "absolute match with same case only"
  // behavior which is no good for most searches
  self.sortify = function(s) {
    return self.slugify(s, { separator: ' ' });
  };

  // Turn a user-entered search query into a regular expression, suitable
  // for filtering on the highSearchText or lowSearchText property. Removes
  // a list of English "stop words" to reduce the risk of a very slow
  // MongoDB query on a large data set. If the string contains multiple words,
  // at least one space is required between them in matching documents, but
  // additional words may also be skipped between them, up to a reasonable
  // limit to preserve performance and avoid useless results
  self.searchify = function(q) {
    q = self.sortify(q);
    q = self.removeStopWords(q);
    q = q.replace(/ /g, ' .{0,20}?');
    q = new RegExp(q);
    return q;
  };

  self._stopWords = self.options.stopWords || [ "as", "able", "about", "above", "according", "accordingly", "across", "actually", "after", "afterwards", "again", "against", "aint", "all", "allow", "allows", "almost", "alone", "along", "already", "also", "although", "always", "am", "among", "amongst", "an", "and", "another", "any", "anybody", "anyhow", "anyone", "anything", "anyway", "anyways", "anywhere", "apart", "appear", "appreciate", "appropriate", "are", "arent", "around", "as", "aside", "ask", "asking", "associated", "at", "available", "away", "awfully", "be", "became", "because", "become", "becomes", "becoming", "been", "before", "beforehand", "behind", "being", "believe", "below", "beside", "besides", "best", "better", "between", "beyond", "both", "brief", "but", "by", "cmon", "cs", "came", "can", "cant", "cannot", "cant", "cause", "causes", "certain", "certainly", "changes", "clearly", "co", "com", "come", "comes", "concerning", "consequently", "consider", "considering", "contain", "containing", "contains", "corresponding", "could", "couldnt", "course", "currently", "definitely", "described", "despite", "did", "didnt", "different", "do", "does", "doesnt", "doing", "dont", "done", "down", "downwards", "during", "each", "edu", "eg", "eight", "either", "else", "elsewhere", "enough", "entirely", "especially", "et", "etc", "even", "ever", "every", "everybody", "everyone", "everything", "everywhere", "ex", "exactly", "example", "except", "far", "few", "fifth", "first", "five", "followed", "following", "follows", "for", "former", "formerly", "forth", "four", "from", "further", "furthermore", "get", "gets", "getting", "given", "gives", "go", "goes", "going", "gone", "got", "gotten", "greetings", "had", "hadnt", "happens", "hardly", "has", "hasnt", "have", "havent", "having", "he", "hes", "hello", "help", "hence", "her", "here", "heres", "hereafter", "hereby", "herein", "hereupon", "hers", "herself", "hi", "him", "himself", "his", "hither", "hopefully", "how", "howbeit", "however", "id", "ill", "im", "ive", "ie", "if", "ignored", "immediate", "in", "inasmuch", "inc", "indeed", "indicate", "indicated", "indicates", "inner", "insofar", "instead", "into", "inward", "is", "isnt", "it", "itd", "itll", "its", "its", "itself", "just", "keep", "keeps", "kept", "know", "knows", "known", "last", "lately", "later", "latter", "latterly", "least", "less", "lest", "let", "lets", "like", "liked", "likely", "little", "look", "looking", "looks", "ltd", "mainly", "many", "may", "maybe", "me", "mean", "meanwhile", "merely", "might", "more", "moreover", "most", "mostly", "much", "must", "my", "myself", "name", "namely", "nd", "near", "nearly", "necessary", "need", "needs", "neither", "never", "nevertheless", "new", "next", "nine", "no", "nobody", "non", "none", "noone", "nor", "normally", "not", "nothing", "novel", "now", "nowhere", "obviously", "of", "off", "often", "oh", "ok", "okay", "old", "on", "once", "one", "ones", "only", "onto", "or", "other", "others", "otherwise", "ought", "our", "ours", "ourselves", "out", "outside", "over", "overall", "own", "particular", "particularly", "per", "perhaps", "placed", "please", "plus", "possible", "presumably", "probably", "provides", "que", "quite", "qv", "rather", "rd", "re", "really", "reasonably", "regarding", "regardless", "regards", "relatively", "respectively", "right", "said", "same", "saw", "say", "saying", "says", "second", "secondly", "see", "seeing", "seem", "seemed", "seeming", "seems", "seen", "self", "selves", "sensible", "sent", "serious", "seriously", "seven", "several", "shall", "she", "should", "shouldnt", "since", "six", "so", "some", "somebody", "somehow", "someone", "something", "sometime", "sometimes", "somewhat", "somewhere", "soon", "sorry", "specified", "specify", "specifying", "still", "sub", "such", "sup", "sure", "ts", "take", "taken", "tell", "tends", "th", "than", "thank", "thanks", "thanx", "that", "thats", "thats", "the", "their", "theirs", "them", "themselves", "then", "thence", "there", "theres", "thereafter", "thereby", "therefore", "therein", "theres", "thereupon", "these", "they", "theyd", "theyll", "theyre", "theyve", "think", "third", "this", "thorough", "thoroughly", "those", "though", "three", "through", "throughout", "thru", "thus", "to", "together", "too", "took", "toward", "towards", "tried", "tries", "truly", "try", "trying", "twice", "two", "un", "under", "unfortunately", "unless", "unlikely", "until", "unto", "up", "upon", "us", "use", "used", "useful", "uses", "using", "usually", "value", "various", "very", "via", "viz", "vs", "want", "wants", "was", "wasnt", "way", "we", "wed", "well", "were", "weve", "welcome", "well", "went", "were", "werent", "what", "whats", "whatever", "when", "whence", "whenever", "where", "wheres", "whereafter", "whereas", "whereby", "wherein", "whereupon", "wherever", "whether", "which", "while", "whither", "who", "whos", "whoever", "whole", "whom", "whose", "why", "will", "willing", "wish", "with", "within", "without", "wont", "wonder", "would", "would", "wouldnt", "yes", "yet", "you", "youd", "youll", "youre", "youve", "your", "yours", "yourself", "yourselves", "zero" ];

  self._stopWordsMap = {};
  _.each(self._stopWords, function(word) {
    self._stopWordsMap[word] = true;
  });

  // Remove "stop words" (words that are not significant to searches and result
  // in very slow searches or unnecessarily large result sets).
  self.removeStopWords = function(s) {
    var words = s.split(/ /);
    return _.filter(words, function(word) {
      return !_.has(self._stopWordsMap, word);
    }).join(' ');
  };
};


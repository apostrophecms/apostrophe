import assert from "assert";
import { generate, count } from "../index.js";
import { wordList } from "../index.js";

const longestWordSize = wordList.reduce((longestWord, currentWord) =>
  currentWord.length > longestWord.length ? currentWord : longestWord
).length;

describe("random-words : generate", function () {
  it("should return one word when called with no arguments", function () {
    const word = generate();
    assert.ok(typeof word === "string", "word is a string");
    assert.ok(word.length, "word is not empty");
    assert.ok(word.indexOf(" ") === -1, "word does not contain spaces");
  });
  it("should return 5 words when called with the number 5", function () {
    const words = generate(5);
    assert.ok(words.length === 5, "contains 5 elements");
  });
  it("should return between 5 and 10 words when called with min: 5 and max: 10", function () {
    const words = generate({ min: 5, max: 10 });
    assert.ok(words.length >= 5 && words.length <= 10);
  });
  it("returns result of variable length when called with min: 5 and max: 10", function () {
    const lengths = {};
    for (let i = 0; i < 100; i++) {
      const words = generate({ min: 5, max: 10 });
      lengths[words.length] = true;
    }
    assert.ok(Object.keys(lengths).length > 1, "result varies in length");
  });
  it("should return 5 space separated words when join is used with exactly: 5", function () {
    let phrase = generate({ exactly: 5, join: " " });
    assert.ok(typeof phrase === "string", "result is a string");
    assert.ok(phrase.match(/\S/), "result contains text, not just spaces");
    phrase = phrase.replace(/[\S]/g, "");
    assert.ok(
      phrase.length === 4,
      "result contains 4 spaces joining the 5 words"
    );
  });
  it("should return 5 concatenated words when join is used with an empty string and exactly: 5", function () {
    const phrase = generate({ exactly: 5, join: "" });
    assert.ok(typeof phrase === "string", "result is a string");
    assert.ok(phrase.match(/\w/), "result contains text, no spaces");
  });
  it("should return 5 words when called with exactly: 5 and join: false", function () {
    const words = generate({ exactly: 5, join: false });
    assert.ok(words.length === 5, "contains 5 elements");
  });
  it("should return 5 words when called with exactly: 5 and join: null", function () {
    const words = generate({ exactly: 5, join: null });
    assert.ok(words.length === 5, "contains 5 elements");
  });
  it("should return one word with a minimum of 8 letters", function () {
    const minWordSize = 8;
    const word = generate({ minLength: minWordSize });

    assert.ok(word.length >= minWordSize, "result is less than 8 letters");
  });
  it("should return one word with a maximum of 5 letters", function () {
    const maxWordSize = 5;
    const word = generate({ maxLength: maxWordSize });

    assert.ok(word.length <= maxWordSize, "result exceeded 5 letters");
  });
  it("should return one word with the length between 3 and 5 ", function () {
    const minLengthSize = 3;
    const maxLengthSize = 5;
    const word = generate({
      minLength: minLengthSize,
      maxLength: maxLengthSize,
    });

    assert.ok(
      word.length >= minLengthSize && word.length <= maxLengthSize,
      "result is not between the limit of 3 and 5"
    );
  });
  it("should only return words with a minimum of 8 letters", function () {
    const minWordSize = 8;
    const words = generate({ exactly: 10000, minLength: minWordSize });
    words.forEach((word) => {
      assert.ok(word.length >= minWordSize, "result is less than 8 letters");
    });
  });
  it("should only return words with a maximum of 5 letters", function () {
    const maxWordSize = 5;
    const words = generate({ exactly: 10000, maxLength: maxWordSize });
    words.forEach((word) => {
      assert.ok(word.length <= maxWordSize, "result exceeded 5 letters");
    });
  });
  it("should only return words with the length between 3 and 5", function () {
    const minLengthSize = 3;
    const maxLengthSize = 5;
    const words = generate({
      exactly: 10000,
      minLength: minLengthSize,
      maxLength: maxLengthSize,
    });
    words.forEach((word) => {
      assert.ok(
        word.length >= minLengthSize && word.length <= maxLengthSize,
        "result is not between the limit of 3 and 5"
      );
    });
  });
  it("should only return words with length = 5", function () {
    const wordSize = 5;
    const words = generate({
      exactly: 10000,
      minLength: wordSize,
      maxLength: wordSize,
    });
    words.forEach((word) => {
      assert.ok(word.length === wordSize, "word length is different from 5");
    });
  });
  it("maxLength larger than the longest word should not result in an endless loop", function () {
    const wordSize = 100000;
    const words = generate({
      exactly: 1000,
      maxLength: wordSize,
    });
    words.forEach((word) => {
      assert.ok(word.length <= longestWordSize);
    });
  });
  it("minLength larger than the longest word should not result in an endless loop", function () {
    const wordSize = 100000;
    const words = generate({
      exactly: 1000,
      minLength: wordSize,
    });
    words.forEach((word) => {
      assert.ok(word.length <= longestWordSize);
    });
  });
  it("must return a word even without passing a number to minLength and maxLength", function () {
    const word1 = generate({ minLength: undefined, maxLength: false });
    const word2 = generate({ minLength: "string", maxLength: null });
    assert.ok(
      typeof word1 === "string" && typeof word2 === "string",
      "result is not a string"
    );
  });
  it("should return 5 space separated words for each string if wordsPerString is set to 5 and exactly > 1", function () {
    const words = generate({ exactly: 10, wordsPerString: 5 });
    words.forEach((string) => {
      const stringSplitted = string.split(" ");
      assert.ok(
        stringSplitted.length === 5,
        "the i-th string contains 5 words"
      );
    });
  });
  it("should reuturn 5 words separated by a separator for each string if wordsPerString > 1, separator is defined as a string and exactly > 1", function () {
    const separator = "-";
    const words = generate({ exactly: 10, wordsPerString: 5, separator });
    words.forEach((string) => {
      const stringSplitted = string.split(separator);
      assert.ok(typeof separator === "string", "separator is a string");
      assert.ok(
        stringSplitted.length === 5,
        "the i-th string contains 5 words"
      );
    });
  });
  it("should return styled strings if formatter is defined as a function that returns a string", function () {
    const formatter = (word) => word.toUpperCase();
    assert.ok(typeof formatter === "function", "formatter is a function");
    assert.ok(
      typeof formatter("test") === "string",
      "formatter returns a string"
    );
    const words = generate({ exactly: 10, formatter });
    words.forEach((word) => {
      assert.ok(word === word.toUpperCase(), "word is formatted");
    });
  });
  it("should return the same words if the same seed is used", function () {
    const seed = "seed1";
    const exactly = 20;
    const join = " ";

    const words = generate({ seed, exactly, join });
    const words2 = generate({ seed, exactly, join });

    assert.ok(words == words2, "words are the same");
  });
  it("should return the same number of words if the same seed is used", function () {
    const seed = "seed1";
    const min = 1;
    const max = 10;

    const words = generate({ seed, min, max });
    const words2 = generate({ seed, min, max });

    assert.ok(words.length == words2.length, "number of words is the same");
  });
  it("should return different words if no seeds are provided", function () {
    const exactly = 20;
    const join = " ";

    const words = generate({ exactly, join });
    const words2 = generate({ exactly, join });

    // with 1952 possible words, at least one word in 20 should be different
    assert.ok(words != words2, "words are different");
  });
  it("should return different words if different seeds are used", function () {
    const exactly = 20;

    const words = generate({ seed: "seed1", exactly });
    const words2 = generate({ seed: "seed2", exactly });

    // with these seeds, all words should be different
    for (let i = 0; i < exactly; i++) {
      assert.ok(words[i] != words2[i], "words are different");
    }
  });
  it("should return different number of words if different seeds are used", function () {
    const min = 1;
    const max = 10;

    const words = generate({ seed: "seed1", min, max });
    const words2 = generate({ seed: "seed2", min, max });

    // with these seeds, the number of words should 5 and 3
    assert.ok(words.length != words2.length, "number of words is different");
  });
});

describe("random-words : count", function () {
  it("should return the correct count when no options are provided", function () {
    const totalWords = count();

    assert.ok(typeof totalWords === "number" && totalWords != 0 , "total number of words is a number and is not 0");
  });
  it("should return the correct count when minLength and maxLength options are provided", function () {
    const options = { minLength: 5, maxLength: 8 };
    const totalWords = count(options);

    assert.ok(typeof totalWords === "number" && totalWords != 0 , "total number of words is a number and is not 0");
  });
  it("should return the correct count when only minLength option is provided", function () {
    const options = { minLength: 8 };
    const totalWords = count(options);

    assert.ok(typeof totalWords === "number" && totalWords != 0 , "total number of words is a number and is not 0");
  });
  it("should return 0 when no words satisfy the length criteria", function () {
    const options = { minLength: 30, maxLength: 35 };
    const totalWords = count(options);

    assert.ok(totalWords === 0 , "total number of words should be 0 when no words satisfy the length criteria");
  });
  it("should return 0 when minLength is greater than maxLength", function () {
  const options = { minLength: 10, maxLength: 5 };
  const totalWords = count(options);

    assert.ok(totalWords === 0 , "total number of words should be 0 when minLength is greater than maxLength");
  });
  it("should return the default count when incorrect arguments are provided", function () {
    const options = "Illegal arguments";
    const totalWords = count(options);

    assert.ok(typeof totalWords === "number" && totalWords != 0 , "total number of words is a number and is not 0");
  });
  it("should treat non-number minLength as default and return the correct count", function () {
    const options = { minLength: "5" };
    const totalWords = count(options);

    assert.ok(typeof totalWords === "number" && totalWords != 0 , "total number of words is a number and is not 0");
  });
  it("should ignore other options and return the count based on minLength and maxLength only", function () {
  const options = { minLength: 4, maxLength: 7, separator: "-", formatter: (word) => word.toUpperCase(), seed: "random" };
  const totalWords = count(options);
 
    assert.ok(typeof totalWords === "number" && totalWords != 0 , "total number of words is a number and is not 0");
  });
  it("should return 0 when negative minLength and maxLength are passed", function () {
    const options = { minLength: -20, maxLength: -10 };
    const totalWords = count(options);

    assert.ok(totalWords === 0 , "total number of words should be 0 when no words satisfy the length criteria");
  });
  it("should return the correct count when minLength is -1 and maxLength is 10", function () {
    const options = { minLength: -1, maxLength: 10 };
    const totalWords = count(options);

    assert.ok(typeof totalWords === "number" && totalWords != 0 , "total number of words is a number and is not 0");
  });
})
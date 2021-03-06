'use strict';

/*
 * Dependencies.
 */

var polarities,
    visit;

polarities = require('./data/data.json');
visit = require('retext-visit');

/*
 * Constants.
 */

var has,
    NEUTRAL,
    POSITIVE,
    NEGATIVE;

has = Object.prototype.hasOwnProperty;

NEUTRAL = 'neutral';
POSITIVE = 'positive';
NEGATIVE = 'negative';

/**
 * Classify, from a given `polarity` between `-5` and
 * `5`, if the polarity is `NEGATIVE` (negative),
 * `NEUTRAL` (0), or `POSITIVE` (positive).
 *
 * @param {number} polarity
 * @return {string}
 */
function classify(polarity) {
    return polarity > 0 ? POSITIVE : polarity < 0 ? NEGATIVE : NEUTRAL;
}

/**
 * Detect if a value is used to negate something
 *
 * @param {Node} node
 * @return {boolean}
 */
function isNegation(node) {
    var value;

    value = node.toString().toLowerCase();

    if (
        value === 'not' ||
        value === 'neither' ||
        value === 'nor' ||
        /n['’]t/.test(value)
    ) {
        return true;
    }

    return false;
}

/**
 * Handler for a polarity change in a `parent`.
 *
 * @param {Parent} parent
 */
function onchangeinparent(parent) {
    var polarity,
        hasNegation,
        node;

    if (!parent) {
        return;
    }

    polarity = 0;

    node = parent.head;

    while (node) {
        /*
         * Add the polarity. If the previous word,
         * contained negation, negate the polarity.
         */

        if (node.data.polarity) {
            polarity += (hasNegation ? -1 : 1) * node.data.polarity;
        }

        /*
         * If the value is a word, remove any present
         * negation. Otherwise, add negation if the
         * node contains it.
         */

        if (node.type === node.WORD_NODE) {
            if (hasNegation) {
                hasNegation = false;
            } else if (isNegation(node)) {
                hasNegation = true;
            }
        }

        node = node.next;
    }

    parent.data.polarity = polarity;
    parent.data.valence = classify(polarity);

    onchangeinparent(parent.parent);
}

/**
 * Factory to create a bound `onchange` method.
 *
 * @param {Object?} inject
 * @return {function(this:Node)}
 */
function onchangeFactory(inject) {
    /**
     * Handler for a value change in a `node`.
     *
     * @this {Node}
     */
    return function () {
        var self,
            data,
            polarity,
            value;

        self = this;
        data = self.data;
        polarity = 0;
        value = self.toString().toLowerCase();

        if (inject && has.call(inject, value)) {
            polarity = inject[value];
        } else if (has.call(polarities, value)) {
            polarity = polarities[value];
        }

        data.polarity = polarity;
        data.valence = classify(polarity);

        onchangeinparent(self.parent);
    };
}

/**
 * Define `onrun`.
 *
 * @param {Node} tree
 */
function onrun(tree) {
    tree.visit(tree.SENTENCE_NODE, function (sentenceNode) {
        onchangeinparent(sentenceNode.parent);
    });
}

/**
 * Define `sentiment`.
 *
 * @param {Retext} retext
 * @return {Function} - See `onrun`.
 */
function sentiment(retext, inject) {
    var TextOM,
        onchange;

    TextOM = retext.TextOM;

    retext.use(visit);

    onchange = onchangeFactory(inject);

    TextOM.Text.on('insert', onchange);
    TextOM.WordNode.on('insert', onchange);

    TextOM.Node.on('remove', onchangeinparent);

    return onrun;
}

/*
 * Expose `sentiment`.
 */

module.exports = sentiment;

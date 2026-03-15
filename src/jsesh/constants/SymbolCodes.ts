export const SymbolCodes = {
    HALFSPACE: 1,
    FULLSPACE: 2,
    REDPOINT: 3,
    BLACKPOINT: 4,
    FULLSHADE: 5,
    VERTICALSHADE: 6,
    HORIZONTALSHADE: 7,
    QUATERSHADE: 8,
    /**
     * This code means that the symbol is a hieroglyph or similar sign
     * described as a manuel de codage code.
     */
    MDCCODE: 9,

    /**
     * Text inserted as a sign.
     */
    SMALLTEXT: 10,

    // Codes for philological marks
    // Depending on the parser configuration, codes like [[ and ]]
    // can be interpreted either as SYMBOLS or as PHILOLOGICAL COMMENTS

    // Codes to use if the philological comments are understood as parenthesis.
    ERASEDSIGNS: 50,
    EDITORADDITION: 51,
    EDITORSUPERFLUOUS: 52,
    PREVIOUSLYREADABLE: 53,
    SCRIBEADDITION: 54,
    MINORADDITION: 55,
    DUBIOUS: 56,

    // Code to use if philological comments are used as plain symbols.
    // To get these codes, simply multiply the previous ones by two.
    // The end code is : x * 2 + 1
    BEGINERASE: 100,
    ENDERASE: 101,
    BEGINEDITORADDITION: 102,
    ENDEDITORADDITION: 103,
    BEGINEDITORSUPERFLUOUS: 104, // [{ }] => { }
    ENDEDITORSUPERFLUOUS: 105, // [{ }] => { }
    BEGINPREVIOUSLYREADABLE: 106, // [" "] => [| |]
    ENDPREVIOUSLYREADABLE: 107, // [" "] => [| |]
    BEGINSCRIBEADDITION: 108, // [' '] => ' '
    ENDSCRIBEADDITION: 109, // [' '] => ' '
    BEGINMINORADDITION: 110, // [( )] => ()
    ENDMINORADDITION: 111,
    BEGINDUBIOUS: 112, // [? ?] => half [ ]
    ENDDUBIOUS: 113, // [? ?] => half [ ]
} as const

export type SymbolCode = (typeof SymbolCodes)[keyof typeof SymbolCodes]
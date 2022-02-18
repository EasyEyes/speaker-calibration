EMCC = emcc
SOURCES = mleGen.cpp
SOURCES_EXTRA = ""
OUTPUT = mleGen
OUTPUT_EXT = ".wasm"
OUT_DIR = "out"
CC = "g++"

EXPORT_FUNCS_ALL = "['_GenerateSignal', '_GenerateMls', '_FastHadamard', '_PermuteSignal', '_PermuteResponse', '_GeneratetagL', '_GeneratetagS']"
EXPORT_FUNC = "['_GenerateSignal']"
EXPORTED_FUNCTIONS=$(EXPORT_FUNC)

EMFLAGS = -s EXPORTED_FUNCTIONS='_GenerateSignal' --no-entry
EMFLAGS_2 = -s EXPORTED_FUNCTIONS=_GenerateSignal -s WASM=1 -s SINGLE_FILE=1 --no-entry

clean:
	rm -rf *

build: $(SOURCES)
	$(EMCC) $(SOURCES) -o mleGen.js $(EMFLAGS)

buildtest: $(SOURCES)
	emcc mleGen_test.cpp -o mleGen_test.html

binary: $(SOURCES) $(SOURCES_EXTRA)
	$(CC) $(SOURCES) -o $(OUTPUT)
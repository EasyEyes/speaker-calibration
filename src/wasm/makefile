EMCC := emcc
CC := g++

SOURCE_FILE = "mlsGen.cpp"
OUTPUT_FILE = mlsGen.js

SOURCE_DIR = ./src
OUTPUT_DIR = ./out

SOURCE = $(SOURCE_DIR)/$(SOURCE_FILE)
OUTPUT = $(OUTPUT_DIR)/$(OUTPUT_FILE)

TEST_DIR = ./test

EXPORT_FUNCS_ALL = "['_GenerateSignal', '_GenerateMls', '_FastHadamard', '_PermuteSignal', '_PermuteResponse', '_GeneratetagL', '_GeneratetagS']"
EXPORT_FUNC = "['_GenerateSignal']"
EXPORTED_FUNCTIONS=$(EXPORT_FUNC)

EMFLAGS = -s EXPORTED_FUNCTIONS='_GenerateSignal' --no-entry
EMFLAGS_2 = -s EXPORTED_FUNCTIONS=_GenerateSignal -s WASM=1 -s SINGLE_FILE=1 --no-entry

# clean:
# 	rm -rf *
# 	$(EMCC) $(SOURCE_DIR)/$(SOURCE) -o $(OUTPUT_DIR)/$(OUTPUT) $(EMFLAGS)

build: $(SOURCE_FILE)
	emcc mlsGen.cpp -o mlsGen.js -s EXPORTED_FUNCTIONS='["_GenerateSignal"]' --no-entry

buildtest: $(SOURCE)
	emcc mlsGen_test.cpp -o mlsGen_test.html
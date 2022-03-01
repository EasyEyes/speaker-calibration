##################################### UTILITIES ######################################
COM_COLOR   = \033[0;34m
OBJ_COLOR   = \033[0;36m
OK_COLOR    = \033[0;32m
ERROR_COLOR = \033[0;31m
WARN_COLOR  = \033[0;33m
NO_COLOR    = \033[m

OK_STRING    = "[OK]"
ERROR_STRING = "[ERROR]"
WARN_STRING  = "[WARNING]"
COM_STRING   = "Compiling..."

define run_and_test
printf "%b" "$(COM_COLOR)$(COM_STRING) $(OBJ_COLOR)$(@F)$(NO_COLOR)\r"; \
$(1) 2> $@.log; \
RESULT=$$?; \
if [ $$RESULT -ne 0 ]; then \
  printf "%-60b%b" "$(COM_COLOR)$(COM_STRING)$(OBJ_COLOR) $@" "$(ERROR_COLOR)$(ERROR_STRING)$(NO_COLOR)\n"   ; \
elif [ -s $@.log ]; then \
  printf "%-60b%b" "$(COM_COLOR)$(COM_STRING)$(OBJ_COLOR) $@" "$(WARN_COLOR)$(WARN_STRING)$(NO_COLOR)\n"   ; \
else  \
  printf "%-60b%b" "$(COM_COLOR)$(COM_STRING)$(OBJ_COLOR) $(@F)" "$(OK_COLOR)$(OK_STRING)$(NO_COLOR)\n"   ; \
fi; \
cat $@.log; \
rm -f $@.log; \
exit $$RESULT
endef

##################################### WASM ########################################
PROJECT_NAME = mlsGen

# directories
DIST_DIR = ./dist/
SRC_DIR = $(addprefix ./src/,$(PROJECT_NAME)/)

# WASM files
SRC_FILE := $(addprefix $(SRC_DIR),$(PROJECT_NAME).cpp) # SRC_DIR + PROJECT_NAME + .cpp
OUTPUT_WASM_JS := $(addprefix $(DIST_DIR),$(PROJECT_NAME).js) # DIST_DIR + PROJECT_NAME + .js
OUTPUT_WASM := $(addprefix $(DIST_DIR),$(PROJECT_NAME).wasm) # DIST_DIR + PROJECT_NAME + .wasm
OUTPUT := $(addprefix $(DIST_DIR),$(PROJECT_NAME).*) # DIST_DIR + PROJECT_NAME + .*

# emcc compiler options
CC = em++ # emcc compiler front end
STD = --std=c++11 # C++ standard
OPTIMIZE = -O2 # optimization level
ENV = -s ENVIRONMENT='web' # environment
NOENTRY = --no-entry # no entry point (no main function)
STANDALONE = -s STANDALONE_WASM # standalone WASM
MODULARIZE = -s MODULARIZE=1 -s 'EXPORT_NAME="createMLSGenModule"' # puts all of the generated JavaScript into a factory function
BIND = -lembind # links against embind library

# build the WASM + JS glue module, linked to embind library
$(PROJECT_NAME)_bind:
	@mkdir -p $(@D)
	@$(call run_and_test, $(CC) $(STD) $(BIND) $(SRC_FILE) -o $(OUTPUT_WASM_JS) $(MODULARIZE) $(OPTIMIZE) $(ENV) $(NOENTRY))

# build the WASM + JS glue module
$(PROJECT_NAME)_module:
	@mkdir -p $(@D)
	@$(call run_and_test, $(CC) $(STD) $(SRC_FILE) -o $(OUTPUT_WASM_JS) $(MODULARIZE) $(OPTIMIZE) $(ENV) $(NOENTRY))

# build the standalone WASM file
$(PROJECT_NAME)_wasm:
	@mkdir -p $(@D)
	@$(call run_and_test, $(CC) $(STD) $(SRC_FILE) -o $(OUTPUT_WASM) $(STANDALONE) $(OPTIMIZE) $(ENV) $(NOENTRY))

# clean the WASM + JS files
.PHONY: clean
clean:
	@mkdir -p $(@D)
	@$(call run_and_test, rm -f $(OUTPUT))

.PHONY: rebuild
rebuild:
	@make clean; make $(PROJECT_NAME)_bind
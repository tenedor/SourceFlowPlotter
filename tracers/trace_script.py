# anything here will be run before the trace
def setup():
  pass


# specify functions and files to not trace into
#
# Return a dictionary with 'function' and 'file' attributes containing lists of
# function names and file names, respectively; or return None.
#
# XXX: blacklist functionality is not yet implemented; see trace.py
def blacklist():
  return None


# specify functions and files to trace into
#
# Return a dictionary with 'function' and 'file' attributes containing lists of
# function names and file names, respectively, and a 'whitelist_mode' attribute
# specifying how to interpret the whitelist; or return None.
#
# By default, the whitelist mode is 'selective_override', in which case the
# whitelist is only used to permit whitelisted functions in blacklisted files.
# The 'whitelist_only' mode rejects all functions that are not whitelisted or in
# a whitelisted file, and additionally rejects those that would be rejected in
# 'selective_override' mode.
#
# XXX: whitelist functionality is not yet implemented; see trace.py
def whitelist():
  return None


# this script is run during the trace. all function calls will be traced
def run_trace_script():
  import test
  test.triple(20)
  test.recursive_start(5)


# anything here will be run after the trace
def teardown():
  pass


# list of source code file paths relative to source_files/ directory
def source_files():
  return ['test.py']


# name of output file (or file path relative to sfp data directory)
def outfile():
  return 'test.py.trace.json'

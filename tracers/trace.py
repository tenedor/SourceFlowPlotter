import sys
import time

"""
** Future plans **
==================

The next version of this program should be the part B of the following scheme:

In part A, construct a groupings tree for the code text (e.g. function groups,
loop groups, conditional groups). Use whatever strategies to do this (e.g.
static code analysis, tracing).

In part B, trace the code to construct an execution nesting tree. In particular,
construct this tree with full group awareness given the groupings defined by
part A.


** Useful object properties seen during system trace **
=======================================================

frame
  f_back            next outer frame object (this frame's caller)
  f_code            code object being executed in this frame
  f_lineno          current line number in Python source code
  f_locals          local namespace seen by this frame
  f_builtins        builtins namespace seen by this frame
  f_globals         global namespace seen by this frame
  f_trace           tracing function for this frame, or None

code
  co_filename       name of file in which this code object was created
  co_name           name with which this code object was defined
  co_firstlineno    number of first line in Python source code
  co_argcount       number of arguments (not including * or ** args)
  co_nlocals        number of local variables
  co_names          tuple of names of local variables from a containing scope
  co_varnames       tuple of names of arguments and local variables


** Control flow tree node formats **
====================================

Use camelCase names for style compatibility with javascript.

root_node = {
  'type': 'root',
  'id': 'root',
  'name': 'root',
  'parent': None,
  'externalChildren': [flow_group, ...],
  'externalCodeLineRanges': {file_id: [[first, last], ...], ...},
  'stepRange': [0, last],
  'timeRange': [0, exit]
}

flow_group_node = {
  'type': 'flowGroup',
  'id': flow_group_uid,
  'fileName': file_name,
  'lineNumber': line_no,
  'name': function_name,
  'parent': parent,
  'internalChildren': [child, ...],
  'internalCodeLineRange': [first, last],
  'externalChildren': [flow_group, ...],
  'externalCodeLineRanges': {file_id: [[first, last], ...], ...},
  'recursiveInternalChilden': [flow_group, ...],
  'recursiveInternalCodeLineRanges': [[first, last], ...],
  'stepRange': [first, last],
  'timeRange': [enter, exit]
}

flow_point_node = {
  'type': 'flowPoint',
  'id': flow_point_uid,
  'fileName': file_name,
  'lineNumber': line_no,
  'code': code_lines[file_name][line_no],
  'parent': parent,
  'internalChildren': [child, ...],
  'internalCodeLineRange': [first, last],
  'externalChildren': [flow_group, ...],
  'externalCodeLineRanges': {file_id: [[first, last], ...], ...},
  'recursiveInternalChilden': [child, ...],
  'recursiveInternalCodeLineRanges': [[first, last], ...],
  'stepRange': [first, last],
  'timeRange': [enter, exit],
  'individualStepIndex': step,
  'individualTimeRange': [enter, exit]
}
"""

tracer = {
  # the control flow tree being constructed
  'control_flow_tree': {
    'type': 'root',
    'id': 'root',
    'name': 'root',
    'parent': None,
    'depth': -1,
    'externalChildren': [],
    'externalCodeLineRanges': {},
    'stepRange': [0, None],
    'timeRange': [0, None]
  },

  # tracing state
  'current_parent_node': None,
  'previous_node': None,
  'previous_flow_point_node': None,
  'depth': -1,

  # indexing state
  'flow_group_index': 0,
  'flow_point_step_index': 0,
  'start_time': None,

  # dummy node; used in place of setting `previous_flow_point_node` to None
  'dummy_flow_point_node': {
    'timeRange': [0, None],
    'individualTimeRange': [0, None]
  },

  # information about where to trace
  'blacklist': None,
  'whitelist': None
}

# initialize tracer
tracer['current_parent_node'] = tracer['control_flow_tree']['parent']
tracer['previous_node'] = tracer['control_flow_tree']
tracer['previous_flow_point_node'] = tracer['dummy_flow_point_node']


def polish_and_propagate_up_external_ranges(concluding_node, ancestors):
  # ensure that concluding node's internal and external ranges don't overlap
  file_name = concluding_node['fileName']
  external_ranges = concluding_node['externalCodeLineRanges']
  internal_range = [_ for _ in concluding_node['internalCodeLineRange']]
  if file_name in external_ranges:
    filtered_ranges = []
    ranges = external_ranges[file_name]
    while ranges:
      r = ranges.pop(0)
      # r is entirely before internal range
      if r[1] <= internal_range[0]:
        filtered_ranges.append(r)
      # r is partially before internal range
      elif r[0] < internal_range[0]:
        r[1] = internal_range[0]
        filtered_ranges.append(r)
      # r extends beyond internal range (so break out of the loop)
      elif internal_range[1] < r[1]:
        # r is partially clipped by internal range
        if r[0] < internal_range[1]:
          r[0] = internal_range[1]
        filtered_ranges.append(r)
        break
    # append any remaining ranges and set property
    filtered_ranges.extend(ranges)
    external_ranges[file_name] = filtered_ranges

  # clone external ranges object and add internal range
  concluding_ranges = {}
  for key, ranges in external_ranges.iteritems():
    concluding_ranges[key] = [[_ for _ in r] for r in ranges]
  if file_name not in concluding_ranges:
    concluding_ranges[file_name] = [internal_range]
  else:
    ranges = concluding_ranges[file_name]
    inserted = False
    for i in range(len(ranges)):
      if internal_range[0] < ranges[i][0]:
        ranges.insert(i, internal_range)
        inserted = True
        break
    inserted or ranges.append(internal_range)

  # add concluding node's ranges to each ancestor's ranges
  for ancestor in ancestors:
    if not ancestor:
      break
    external_ranges = ancestor['externalCodeLineRanges']
    for key, ranges in concluding_ranges.iteritems():
      # clone ranges
      ranges = [[_ for _ in r] for r in ranges]
      # add ranges directly if there's no risk of overlap
      if key not in external_ranges:
        external_ranges[key] = ranges
      # else combine ranges
      else:
        combined_ranges = []
        _ranges = external_ranges[key]
        while _ranges and ranges:
          if _ranges[0][0] < ranges[0][0]:
            r = _ranges.pop(0)
          else:
            r = ranges.pop(0)
          if combined_ranges and r[0] <= combined_ranges[-1][1]:
            combined_ranges[-1][1] = r[1]
          else:
            combined_ranges.append(r)
        combined_ranges.extend(_ranges or ranges)
        external_ranges[key] = combined_ranges


def trace_handler(frame, event, arg):
  # Switch on event type:
  # ---------------------

  # Down Two Levels
  if event == 'call':
    code_block = frame.f_code

    # only step down into calls we're tracing
    if tracer['whitelist'] or tracer['blacklist']:
      pass # TODO: implement whitelist and blacklist functionality
    if (code_block.co_name == 'run_trace_script' and
        len(code_block.co_filename) >= 22 and
        code_block.co_filename[-23:] == 'tracers/trace_script.py'):
      print '-- (' + code_block.co_name + ') --'
      return
    # Ignore write() calls from print statements
    # (warning - this could be an actual function name though!)
    # TODO: find a better way to identify print statements
    # TODO: this should instead be harvested for side effect tracking
    if code_block.co_name == 'write':
      return

    if code_block.co_name == '<module>':
      pass # TODO - figure out how to get the module's name here

    print '--', code_block.co_name, '--'

    # since we've stepped down, the previous node is this flow group's parent
    tracer['depth'] += 1
    parent = tracer['previous_node']

    # get data
    index = tracer['flow_group_index']
    tracer['flow_group_index'] += 1
    if tracer['start_time'] == None:
      elapsed_time = 0
      tracer['start_time'] = time.clock()
    else:
      elapsed_time = time.clock() - tracer['start_time']

    # update previous flow point's time information
    tracer['previous_flow_point_node']['individualTimeRange'][1] = elapsed_time
    tracer['previous_flow_point_node']['timeRange'][1] = elapsed_time

    # create a flow group node for this call
    flow_group_node = {
      'type': 'flowGroup',
      'id': index,
      'uid': 'flowGroup:%d' % index,
      'fileName': code_block.co_filename,
      'lineNumber': code_block.co_firstlineno,
      'name': code_block.co_name,
      'parent': parent,
      'depth': tracer['depth'],
      'internalChildren': [],
      'internalCodeLineRange': [frame.f_lineno, frame.f_lineno],
      'externalChildren': [],
      'externalCodeLineRanges': {},
      'recursiveInternalChilden': [],
      'recursiveInternalCodeLineRanges': [],
      'stepRange': [tracer['flow_point_step_index'], None],
      'timeRange': [elapsed_time, None]
    }

    # add node to parent
    parent['externalChildren'].append(flow_group_node)

    # update tracing state
    tracer['depth'] += 1
    tracer['current_parent_node'] = flow_group_node
    tracer['previous_node'] = flow_group_node
    tracer['previous_flow_point_node'] = tracer['dummy_flow_point_node']

    # callback to trace this local context
    return trace_handler


  # Step Forward
  elif event == 'line':
    # the parent node is unchanged
    parent = tracer['current_parent_node']

    # get data
    step = tracer['flow_point_step_index']
    tracer['flow_point_step_index'] += 1
    elapsed_time = time.clock() - tracer['start_time']

    # update previous flow point's time information
    tracer['previous_flow_point_node']['individualTimeRange'][1] = elapsed_time
    tracer['previous_flow_point_node']['timeRange'][1] = elapsed_time

    # create a flow point node for this line execution
    flow_point_node = {
      'type': 'flowPoint',
      'id': step,
      'uid': 'flowPoint:%d' % step,
      'fileName': frame.f_code.co_filename,
      'lineNumber': frame.f_lineno,
      'code': None, # code_lines[frame.f_code.co_filename][frame.f_lineno]
      'parent': parent,
      'depth': tracer['depth'],
      'internalChildren': [],
      'internalCodeLineRange': [frame.f_lineno, frame.f_lineno],
      'externalChildren': [],
      'externalCodeLineRanges': {},
      'recursiveInternalChilden': [],
      'recursiveInternalCodeLineRanges': [],
      'stepRange': [step, step],
      'timeRange': [elapsed_time, None],
      'individualStepIndex': step,
      'individualTimeRange': [elapsed_time, None]
    }

    # add node to parent
    parent['internalChildren'].append(flow_point_node)
    if parent['internalCodeLineRange'][1] < frame.f_lineno:
      parent['internalCodeLineRange'][1] = frame.f_lineno

    # update tracing state
    tracer['previous_node'] = flow_point_node
    tracer['previous_flow_point_node'] = flow_point_node


  # Up Two Levels
  elif event == 'return':
    # since we're stepping up, the concluding node is the current parent
    concluding_node = tracer['current_parent_node']
    parent = concluding_node['parent']
    grandparent = parent['parent']

    # get data
    most_recent_step = tracer['flow_point_step_index'] - 1
    elapsed_time = time.clock() - tracer['start_time']

    # update previous flow point's time information
    tracer['previous_flow_point_node']['individualTimeRange'][1] = elapsed_time
    tracer['previous_flow_point_node']['timeRange'][1] = elapsed_time

    # update concluding node
    concluding_node['stepRange'][1] = most_recent_step
    concluding_node['timeRange'][1] = elapsed_time

    # update parent
    parent['stepRange'][1] = most_recent_step
    parent['timeRange'][1] = elapsed_time

    # handle external code line ranges polishing and up-propagating
    ancestors = [parent, grandparent]
    polish_and_propagate_up_external_ranges(concluding_node, ancestors)

    # update tracing state
    tracer['depth'] -= 2
    tracer['current_parent_node'] = grandparent
    tracer['previous_node'] = parent
    tracer['previous_flow_point_node'] = tracer['dummy_flow_point_node']


def strip_parent_references(root):
  children_types = ['internalChildren', 'externalChildren',
      'recursiveInternalChilden']
  queue = [root]
  while queue:
    node = queue.pop()
    if 'parent' in node:
      del node['parent']
    for children_type in children_types:
      if children_type in node:
        queue.extend(node[children_type])


def add_parent_references(root):
  children_types = ['internalChildren', 'externalChildren',
      'recursiveInternalChilden']
  queue = [root]
  while queue:
    node = queue.pop()
    for children_type in children_types:
      if children_type in node:
        queue.extend(node[children_type])
        for child in node[children_type]:
          child['parent'] = node


print '\n >>> enter trace \n'

import trace_script

trace_script.setup()

tracer['blacklist'] = trace_script.blacklist()
tracer['whitelist'] = trace_script.whitelist()
if tracer['whitelist'] or tracer['blacklist']:
  print 'WARNING: whitelist and blacklist functionality are not yet implemented'

sys.settrace(trace_handler)
trace_script.run_trace_script()
sys.settrace(lambda *_: None)

trace_script.teardown()

print '\n >>> exit trace \n'


# print summary of trace
print 'total groups:', tracer['flow_group_index']
print 'total steps:', tracer['flow_point_step_index']
print 'total time:', time.clock() - tracer['start_time']

# remove parent references since json module can't handle recursive objects
strip_parent_references(tracer['control_flow_tree'])

# extract source code's code lines
source_files = trace_script.source_files()
source_code = {}
for source_file in source_files:
  code_lines = []
  with open(source_file, 'r') as fp:
    line_no = 1 # code lines are indexed from 1
    for line in fp.readlines():
      code_lines.append({'codeLineNumber': line_no, 'codeText': line.rstrip()})
      line_no += 1
  source_code[source_file] = code_lines

source_flow_data = {
  'sourceCode': source_code,
  'flowTree': tracer['control_flow_tree']
}

import json
outfile = '../data/%s' % trace_script.outfile()
with open(outfile, 'w') as fp:
  json.dump(source_flow_data, fp)
  print '\nprinted to %s' % outfile

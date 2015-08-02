def double(x):
  x *= 2
  return x

def triple(x):
  x += double(x)
  return x

def recursive_1(x, i):
  if i > 0:
    x += i
    x = recursive_2(x, i - 1)
  return x

def recursive_2(x, i):
  if i > 0:
    x *= i
    x = recursive_1(x, i - 1)
  return x

def recursive_start(n):
  m = recursive_1(1, n)
  print m

if __name__ == '__main__':
  print triple(10)
  print triple(20)
  recursive_start(5)

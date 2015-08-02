def coins(value):
  coin_values = [25, 10, 5, 1]
  coin_hash = {25: 'quarter', 10: 'dime', 5: 'nickel', 1: 'penny'}

  for coin in coin_values:
    i = int(value / coin)
    if i:
      coin_name = coin_hash[coin]
      if i > 1:
        coin_name += 's'
      print '%i %s' % (i, coin_name)
      value -= coin * i


if __name__ == '__main__':
  import argparse

  parser = argparse.ArgumentParser()
  parser.add_argument( 'all', nargs='+' )
  args = parser.parse_args()

  value = 0
  for arg in args.all:
    value += int(arg)
  coins(value)

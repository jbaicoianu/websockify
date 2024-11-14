import multiprocessing

banlist = set()
banqueue = multiprocessing.Queue()
activebanlist = None
print('banlist go')

def load(f):
    activebanlist = f
    print('load ban list!', f, activebanlist)
    with open(f) as fd:
        for l in fd:
            banlist.add(l.strip())
    print(banlist)

def is_banned(ip):
    return ip in banlist

def ban(ip):
    print('ehhh?', ip)
    if not ip in banlist:
        print('go', activebanlist)
        banlist.add(ip)
        if activebanlist:
            with open(activebanlist, 'a') as fd:
                fd.write(ip + '\n')
                print('appended to banlist')
    else:
        print('no?')

def unban(ip):
    if ip in banlist:
        banlist.remove(ip)
        if activebanlist:
            with open(activebanlist, 'w') as fd:
                fd.write('\n'.join(banlist))
                print('wrote full banlist')

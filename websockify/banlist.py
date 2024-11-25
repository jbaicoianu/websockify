import multiprocessing

banlist = set()
banqueue = multiprocessing.Queue()
activebanlist = '/var/lib/websockify/banlist.txt'

def set_active_banlist(f):
    activebanlist = f
    load()

def load():
    try:
        with open(activebanlist) as fd:
            for l in fd:
                banlist.add(l.strip())
    except FileNotFoundError:
        print('Banlist not found, creating', activebanlist)
        with open(activebanlist, 'w') as fd:
            pass

def get():
    load()
    return [ip for ip in banlist]

def is_banned(ip):
    # reload banlist to make sure we've got the latest
    load()
    return ip in banlist

def ban(ip):
    # reload banlist to make sure we've got the latest
    load()
    if not ip in banlist:
        banlist.add(ip)
        if activebanlist:
            with open(activebanlist, 'a') as fd:
                fd.write(ip + '\n')
                print('appended to banlist')

def unban(ip):
    # reload banlist to make sure we've got the latest
    load()
    if ip in banlist:
        banlist.remove(ip)
        if activebanlist:
            with open(activebanlist, 'w') as fd:
                fd.write('\n'.join(banlist) + '\n')
                print('wrote full banlist')

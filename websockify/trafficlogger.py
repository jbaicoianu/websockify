import threading
import multiprocessing
import queue
import time
import sqlite3
import math
import csv

logqueue = multiprocessing.Queue()

def get_client_addr(conn):
    client_addr = 'unknown'
    try:
        client_addr = conn.client_address[0]
    except IndexError:
        pass
    if 'X-Forwarded-For' in conn.headers:
        client_addr = conn.headers['X-Forwarded-For']
    #client_addr += ':%d' % conn.client_address[1]
    return client_addr

class ClientLog:
    def __init__(self, client_addr):
        self.client_addr = client_addr
        self.conn = 0
        self.send = 0
        self.recv = 0

    def log_conn(self):
        self.conn += 1
    def log_recv(self, buflen):
        self.recv += buflen
    def log_send(self, buflen):
        self.send += buflen
    def summarize(self, ts=None):
        return (ts, self.client_addr, self.conn, self.send, self.recv)
    
def get_client_log(client_addr):
    if client_addr not in logframes:
        logframes[client_addr] = ClientLog(client_addr)
    return logframes[client_addr]

def log_conn(conn):
    client_addr = get_client_addr(conn)
    logqueue.put([client_addr, 'conn', 1])

def log_send(conn, buf):
    client_addr = get_client_addr(conn)
    logqueue.put([client_addr, 'send', len(buf)])

def log_recv(conn, buf):
    client_addr = get_client_addr(conn)
    logqueue.put([client_addr, 'recv', len(buf)])

def get_range(begin, end, chunks=10):
    sqlcon = sqlite3.connect('/var/lib/websockify/trafficlog.db')
    cur = sqlcon.cursor()
    d = cur.execute('select * from trafficlog where ts>=? and ts <= ?', (begin, end)).fetchall()

    chunksize = (end - begin) / chunks
    datachunks = []
    csvdata = []
    for i in range(0, chunks):
        datachunks.append({})
    alladdrs = []
    for l in d:
        (ts, addr, conn, send, recv) = l
        total = send + recv
        chunkno = math.floor((ts - begin) / chunksize)
        if not addr in alladdrs:
            alladdrs.append(addr)
        if not addr in datachunks[chunkno]:
            datachunks[chunkno][addr] = 0
        datachunks[chunkno][addr]  += total
        
    csvheader = (['time'])
    for addr in alladdrs:
        csvheader.append(addr)
    csvdata = [csvheader]

    for i in range(0, chunks):
        csvline = [str(math.floor(math.floor((begin + i * chunksize) / chunksize) * chunksize))]
        for addr in alladdrs:
            if addr in datachunks[i]:
                csvline.append(str(datachunks[i][addr]))
            else:
                csvline.append("0")
        csvdata.append(csvline)

    
    csvstr = '\n'.join([','.join(l) for l in csvdata])

    return csvstr


def process_logs():
    logframes = {}
    lastlog = time.time()
    print('logging started')
    sqlcon = sqlite3.connect('/var/lib/websockify/trafficlog.db')
    cur = sqlcon.cursor()
    cur.execute("create table if not exists trafficlog(ts, addr, conn, send, recv)")
    try:
        cur.execute("create index addr_index on trafficlog(addr)")
        cur.execute("create index ts_index on trafficlog(ts)")
    except sqlite3.OperationalError:
        pass
    sqlcon.commit()
    while True:
        now = time.time()
        try:
            for obj in iter(logqueue.get_nowait, None):
                client_addr = obj[0]
                if client_addr not in logframes:
                    logframes[client_addr] = ClientLog(client_addr)
                client = logframes[client_addr]

                if obj[1] == 'conn':
                    client.log_conn()
                elif obj[1] == 'send':
                    client.log_send(obj[2])
                elif obj[1] == 'recv':
                    client.log_recv(obj[2])
        except queue.Empty:
            pass

        if (now - lastlog > 15):
            data = []
            for k in logframes:
                client = logframes[k]
                data.append(client.summarize(now))
            if len(data) > 0:
                cur.executemany("insert into trafficlog values(?, ?, ?, ?, ?)", data)
                sqlcon.commit()
            logframes.clear()
            lastlog = now
        time.sleep(.01)

def start_logger():
    print('start logger')
    t = threading.Thread(target=process_logs)
    t.start()


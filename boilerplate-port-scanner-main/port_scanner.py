import socket
import re
import common_ports

# Solution inspired from https://www.youtube.com/watch?v=apIpFC_MyUI and https://www.youtube.com/watch?v=V-D6ZDIv45I
def get_open_ports(target, port_range, verbose = False):
    # print("target: ", target)
    open_ports = []
    # print(target)
    # # First pattern matching attempt
    # url_pattern = '^[a-z]{3,}[.][\w]+[.][\w]{3,}$'
    # ip_pattern = '^[0-9]{1,}[.][0-9]{1,}[.][0-9]{1,}[.][0-9]{1,}$'
    # url_matching = re.fullmatch(url_pattern, target, re.I)
    # ip_matching = re.fullmatch(ip_pattern, target, re.I)
    
    # if (url_matching):
    #     print("url matching: ", target, url_pattern)
    #     # print("url host by name: ", socket.gethostbyname_ex(target))
    #     try:
    #         hostname, aliaslist, ipaddrlist = socket.gethostbyname_ex(target)
    #     except:
    #         return 'Error: Invalid hostname'
    # elif (ip_matching):
    #     print("ip matching: ", target, ip_pattern)
    #     # print("ip host by name: ", socket.gethostbyaddr(target))
    #     try:
    #         hostname, aliaslist, ipaddrlist = socket.gethostbyaddr(target)
    #     except:
    #         return 'Error: Invalid IP address'
    #     # print("hostname: ", hostname)
    #     # if not hostname:
    #     #     print('Error: Invalid IP address')
    # else:
    #     return 'Error: Invalid hostname'

    # # Second pattern matching attempt
    # target_split = target.split('.')
    # # print(target_split)
    # if len(target_split) == 3:
    #     try:
    #         hostname, aliaslist, ipaddrlist = socket.gethostbyname_ex(target)
    #     except:
    #         return 'Error: Invalid hostname'
    # elif len(target_split) == 4:
    #     try:
    #         hostname, aliaslist, ipaddrlist = socket.gethostbyaddr(target)
    #     except:
    #         return 'Error: Invalid IP address'
    # else:
    #     return 'IP or hostname fails to retrieve'

    # Third pattern matching attempt
    url_pattern = '^[a-z]{1,}$'
    ip_pattern = '^[0-9]{1,}$'
    target_split = target.split('.')
    target_join = ''.join(target_split)
    # print(target_join, target)

    if target_join.isdigit():   # Target is ip
        # print("url matching: ", target, url_pattern)
        try:
            hostname, aliaslist, ipaddrlist = socket.gethostbyaddr(target)
            print(hostname, aliaslist, ipaddrlist)
        except:
            return 'Error: Invalid IP address'
    else:   # Target is url
        # print("ip matching: ", target, url_pattern)
        try:
            hostname, aliaslist, ipaddrlist = socket.gethostbyname_ex(target)
            # print(hostname, aliaslist, ipaddrlist)
        except:
            return 'Error: Invalid hostname'

    # # print("test: ", [re.fullmatch(url_pattern, i, re.I) for i in target_split])
    # if None in [re.fullmatch(url_pattern, i, re.I) for i in target_split]:
    #     return 'Error: Invalid hostname'
    # url_matching = re.fullmatch(url_pattern, target.split('.'), re.I)
    # ip_matching = re.fullmatch(ip_pattern, target.split('.'), re.I)
    # if (url_matching):
    #     print("url matching: ", target, url_pattern)
    #     try:
    #         hostname, aliaslist, ipaddrlist = socket.gethostbyname_ex(target)
    #     except:
    #         return 'Error: Invalid hostname'
    
    
    

    # print(port_range)
    # s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)   # create an INET, STREAMing socket
    # s.settimeout(10)
    for i in range(port_range[0], port_range[1]+1):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)   # create an INET, STREAMing socket
        s.settimeout(1)
        # print(i)

        if i in common_ports.ports_and_services:    # checks if current port is in dictionary
            # print(s.connect_ex((target, i)) == True)
            if s.connect_ex((target, i)):
                # print("The port is closed.")
                continue
            else:
                # print(f"The port is open: {target}:{i}")
                open_ports.append(i)
        s.close()

    # print("open_ports: ", open_ports)
    op_len = len(open_ports) - 1
    verbose_string = ""
    if verbose:
        verbose_string += f"Open ports for {hostname} ({ipaddrlist[0]})\n"
        verbose_string += 'PORT' + '{:>12}'.format('SERVICE') + '\n'
        for i, val in enumerate(open_ports):
            print(val)
            spacing = "".ljust(9 - len(str(val)))  # adjust first column to within 9 characters
            verbose_string += f'{val}{spacing}{common_ports.ports_and_services[val]}\n'
        verbose_string = verbose_string.rstrip('\n')    # removes trailing \n at the end of the verbose string
        open_ports = verbose_string
    # print(verbose_string)

    # if verbose == True:
    #     print(f"Open ports for {URL} ({IP address})")
    #     for i in open_ports:

    return(open_ports)
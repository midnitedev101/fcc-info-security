import hashlib

# Solution inspired by https://www.youtube.com/watch?v=eLRfTyoIy4I
def crack_sha1_hash(hash, use_salts = False):
    passwords_arr = []  # variable to place all passwords in
    read_and_add_to_arr("top-10000-passwords.txt", passwords_arr)   # pass file to 

    if use_salts:   # if salt is true, append and prepend salts to passwords
        top_salt_passwords = {} # declare dictionary with top 10000 passwords including salts
        top_salts = []
        read_and_add_to_arr("known-salts.txt", top_salts)
        for bsalt in top_salts:
            for bpassword in passwords_arr: # read passwords
                prepended = hashlib.sha1(bsalt + bpassword).hexdigest() # add salt before the password
                appended = hashlib.sha1(bpassword + bsalt).hexdigest()  # add salt after the password
                top_salt_passwords[prepended] = bpassword.decode("utf-8")   # set prepended value to password (bytes)
                top_salt_passwords[appended] = bpassword.decode("utf-8")    # set appended value to password (bytes)

        if hash in top_salt_passwords:  # if hash is found in the top_salt_passwords dictionary
            return top_salt_passwords[hash]

    passwords_dict = {}
    for p in passwords_arr:
        hash_line = hashlib.sha1(p).hexdigest() # store password as hashes and then set them up as digest of concatenated passwords (e.g. b305921a3723cd5d70a375cd21a61e60aabb84ec)
        passwords_dict[hash_line] = p.decode("utf-8")   # set the hash line as key and decoded password as the value inside the dictionary (e.g. passwords_dict['b305921a3723cd5d70a375cd21a61e60aabb84ec'] = 'sammy123')

    if hash in passwords_dict:  # if the hash is found inside the passwords dictionary
        return passwords_dict[hash] # return the password
    return "PASSWORD NOT IN DATABASE"
    # return True 

# read password file and add to array
def read_and_add_to_arr(file_name, arr):
    with open(file_name, "rb") as f:    # open file as bytes
        line = f.readline().strip() # strip backslashes from read line
        while line: # while there is a next line
            arr.append(line)    # append line to password array to update it
            line = f.readline().strip() # read next line
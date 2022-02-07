import java.awt.*;
import java.lang.*;
import java.util.*;

/** PassGen Password Generator Applet. 
	Uses keyboard latency as a source of randomness with an arcfour based entropy distiller.
	@author Arnold G. Reinhold 
	@version 2.0.0	Sept. 27, 1996, revised Oct. 21, 2002  
	Copyright  © 1996 A. G. Reinhold, Cambridge, MA, USA
	
	PassGen is free software, and you are welcome to redistribute it 
	under the terms of the GNU General Public License.
	This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; 
	without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 
	See the GNU General Public License for more details: 
		http://www.gnu.ai.mit.edu/copyleft/gpl.html 
	Or you can request a copy by writing to: 
		The Free Software Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.
*/
	public class PassGen extends java.applet.Applet {
	static final boolean debug = false;
	static int NMIXES = 10*256; 	//number of arcfour characters discarded per output character
	static int PRECHARS = 22;		//number of characters required before any output
	static int CHARSPEROUTPUT = 3; 	//number of characters input per output character

	static boolean consonantNext = true;
	static long prevWhen = 0;
	int i;
	static int ii = 0;
	static int jj = 0;
	
	static int S[] = new int[256]; 				//arcfour state vector
	TextArea passwdTA = new TextArea(10,50);  	//passwords appear here
	Choice choose = new Choice();  	//template selector widget
	String template; 
	static int ntmpl = 0; 			//keeps track of where we are in the template
	static int charcount = 0; 		//allows multiple input characters per output char

	public void init() {
		for (i=0; i<256; i++) {S[i] = i;} 
		
		stir(new Date().getTime()); //use current time (long milliseconds) as source randomness
		
		for (i=1; i<=9; i++) {   	//are there any user templates in HTML?
			template = getParameter("template"+i);
			if (template != "" && template != null) choose.addItem(template);
		}
		
		add(new Label("PassGen Random Password Generator, Ver. 2.0.0beta. Copyleft A. G. Reinhold. 1996, 2002"));
		//populate template selector with choices 
		choose.addItem("SSS 99 SSS");
		choose.addItem("MMMMMMMM");
		choose.addItem("CCCC CCCC");
		choose.addItem("LLLLL LLLLL LLLLL");
		choose.addItem("HHHH HHHH HHHH HHHH");
		choose.addItem("AAAAA AAAAA AAAAA AAAAA AAAAA AAAAA AAAAA AAAAA");
		choose.addItem("99999 99999 99999 99999 99999 99999 99999 99999");
		choose.addItem("66666 66666 66666 66666 66666");
		if (debug) choose.addItem("MMM AAA 999 LLL HHH CCC 666");
		choose.select(0);
		add(choose);
		template = choose.getSelectedItem();
		
		setBackground(Color.blue);
		choose.setBackground(Color.gray);
		passwdTA.setBackground(Color.gray);
		passwdTA.setEditable(false);
		passwdTA.setFont(new Font("Courier", 0, 10));

		add(passwdTA); 
		add(new Label("Click in the big text box and just start typing at random."));
		add(new Label("Passwords should begin to appear after "
						+(PRECHARS+CHARSPEROUTPUT)+" input characters."));
		passwdTA.requestFocus();
		stir(new Date().getTime());   //use current time as source randomness again
									  //(initialization could take a few milliseconds)
	}

	public boolean keyDown(Event evt, int key) {
		stir(key);
		stir(evt.when);
		showStatus (String.valueOf(evt.when - prevWhen)); 
		prevWhen = evt.when;
		charcount++;
		if (charcount<PRECHARS) passwdTA.appendText(".");
		else if (charcount==PRECHARS) passwdTA.appendText(".\n");
		else if ((charcount % CHARSPEROUTPUT)==0) addChar();
		return true;
	}

	public boolean keyUp(Event evt, int key) {
		stir(evt.when);
		if (debug) {
			showStatus (String.valueOf(evt.when - prevWhen)); 
			prevWhen = evt.when;
		}
		return false;
	}

	public boolean mouseDown(Event evt, int x, int y) {
		stir(x);
		stir(y);
		showStatus ("Mouse click " + String.valueOf(evt.when)); 
		stir(evt.when);
		return false;
	}

	public boolean action (Event evt, Object what){
		if (evt.target == choose) {
			template = choose.getSelectedItem();
			ntmpl = template.length();
			stir(evt.when);
			showStatus (String.valueOf(evt.when)); 
			return true;
			}
		else return false;
		}	

	/** Maintain a pool of randomness using a modified arcfour generator.*/
	private int stir (long x) {
		if (x<0) x=-x;
		while (true) {
			ii = (ii+1) % 256;
			jj = (int) ((jj + S[ii] + x) % 256);
			int temp = S[ii];
			S[ii] = S[jj];
			S[jj] = temp;
			x = x/256;
			if (x == 0) break;
			}
//	if (debug) passwdTA.appendText(" S"+ii+" "+jj+" "+S[ii]+" "+S[jj]+"\n");
	return (S[(S[ii] + S[jj]) % 256]);
	}

	/** Extract a random value in the range of second argument from the randomness pool. */
	private int extract (int r) {
		int q = 0;
		ii=jj=0;
		for (int k=0; k<NMIXES; k++) {  // we can afford a lot of mixing
			stir (0);
			}
		while (true) {
			q=stir(0); 
			if (q < r*(256/r)) break; // avoid biased choice
			}
		return (q % r);  
		}
		
	/** Add a random character to the textArea as specified by the template. */
	private void addChar() {
		int ch = 0;
		char tmplChar;
		Character charIn;
		
		if (ntmpl >= template.length()) {
			passwdTA.appendText("\n");
			ntmpl=0;
			consonantNext = true;
			return;
		}
		
		tmplChar = template.charAt(ntmpl++);
		
		if (tmplChar == ' ') {
			ch = ' ';
		}
		else if (tmplChar == 'A') {		//random letter [A-Z]
			ch = extract (26) + (int) 'A';
		}
		else if (tmplChar == 'C') {		//random alphanumeric [0-9,A-Z]
			ch =  extract (36);
			if (ch <10) ch = ch + (int) '0';
			else ch = ch + (int) 'A' - 10;
		}
		else if (tmplChar == 'H') {		//random hex digit [0-9,A-F]
			ch = extract (16);
			if (ch <10) ch = ch + (int) '0';
			else ch = ch + (int) 'A' - 10;
		}
		else if (tmplChar == 'L') {		//random alphanumeric upper or lower case [0-9,A-Z,a-z]
			ch =  extract (62);
			if (ch <10) ch = ch + (int) '0';
			else if (ch <36) ch = ch + (int) 'A' - 10;
			else ch = ch + (int) 'a' - 36;
		}
		else if (tmplChar == 'M') {		//random 7-bit ASCII printable [0-9,A-Z,a-z, !"#$%&'()*+,-./:;<=>?[\]^_{|}~]
			ch =  extract (95);
			ch = ch + (int) ' ';
		}
		else if (tmplChar == 'S') {		//random syllable (see addSyllable below)
			addSyllable();
			return;
		}
		else if (tmplChar == '6') {		//random dice throw [0-6]
			ch = extract (6) + (int) '1';
		}
		else if (tmplChar == '9') {		//random decimal digit [0-9]
			ch = extract (10) + (int) '0';
		}
		else return;
		
		//if (debug) showStatus (String.valueOf(ch)); 
		charIn = new Character ((char) ch);
		passwdTA.appendText(charIn.toString());
		consonantNext = true;
		ch = 0;
		charIn = null;
		repaint();
		return;
	}
	
		/** Add a random syllable half to the textArea. */
		private void addSyllable() {
			String consonants[] =
				{"b","c","d","f","g","h","j","k","l","m",
				"n","p","qu","r","s","t","v","w","x","z",
				"ch","cr","fr","nd","ng","nk","nt","ph","pr","rd",
				"sh","sl","sp","st","th","tr"};
			String vowels[] = {"a","e","i","o","u","y"};
			String syl = "";
			
			if (consonantNext) {
				syl = consonants[extract (consonants.length)];
				if (syl != "qu") consonantNext = false;
				}
			else {
				syl = vowels[extract (vowels.length)];
				consonantNext = true;
				}
			passwdTA.appendText(syl);
			syl = "";
			repaint();
			return;
	}	

}
